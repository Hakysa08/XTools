import { createReadStream } from "node:fs";
import { stat, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { apiError } from "@/lib/server/api";
import {
  isValidTaskId,
  listOutputs,
  readManifest,
  resolveOutputPath,
  taskDir,
} from "@/lib/server/storage";
import { writeZip } from "@/lib/pdf/zip";
import { readFile } from "node:fs/promises";

export const runtime = "nodejs";
export const maxDuration = 120;

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".html": "text/html; charset=utf-8",
};

function contentType(name: string): string {
  return MIME[path.extname(name).toLowerCase()] ?? "application/octet-stream";
}

/** RFC 5987 so non-ASCII filenames survive the Content-Disposition header. */
function disposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidTaskId(id)) return apiError("bad-request", "Invalid task id", 400);

  const manifest = await readManifest(id);
  if (!manifest) return apiError("not-found", "Task not found or expired", 404);

  const outputs = await listOutputs(id);
  if (outputs.length === 0) return apiError("not-found", "Nothing to download yet", 404);

  const url = new URL(req.url);
  const requested = url.searchParams.get("file");

  // A single named file, or the only output.
  if (requested || outputs.length === 1) {
    const name = requested ?? outputs[0].name;
    const filePath = resolveOutputPath(id, name);
    if (!filePath) return apiError("bad-request", "Invalid file name", 400);

    let info;
    try {
      info = await stat(filePath);
    } catch {
      return apiError("not-found", "File not found", 404);
    }

    const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
    return new Response(stream, {
      headers: {
        "Content-Type": contentType(name),
        "Content-Length": String(info.size),
        "Content-Disposition": disposition(path.basename(name)),
        "Cache-Control": "no-store",
      },
    });
  }

  // Several outputs: bundle them once and reuse the archive on repeat downloads.
  const zipName = `${manifest.tool}.zip`;
  const zipPath = path.join(taskDir(id), zipName);

  try {
    await unlink(zipPath);
  } catch {
    // No previous archive; nothing to clean up.
  }

  const entries = await Promise.all(
    outputs.map(async (file) => ({ name: file.name, data: await readFile(file.path) })),
  );
  const size = await writeZip(zipPath, entries);

  const stream = Readable.toWeb(createReadStream(zipPath)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(size),
      "Content-Disposition": disposition(zipName),
      "Cache-Control": "no-store",
    },
  });
}
