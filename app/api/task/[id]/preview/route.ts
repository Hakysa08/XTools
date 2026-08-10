import { readFile } from "node:fs/promises";
import path from "node:path";

import { apiError } from "@/lib/server/api";
import { renderPage } from "@/lib/pdf/render";
import { inputDir, isValidTaskId, listInputs, safeFileName } from "@/lib/server/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Renders a page thumbnail for the visual editors (organize, crop, redact…).
 * Reads from the task's *input* folder, before any processing has run.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidTaskId(id)) return apiError("bad-request", "Invalid task id", 400);

  const url = new URL(req.url);
  const requested = url.searchParams.get("file");
  const pageNumber = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const width = Math.min(1600, Math.max(60, Number(url.searchParams.get("w") ?? "240")));

  const inputs = await listInputs(id);
  if (inputs.length === 0) return apiError("not-found", "No files uploaded", 404);

  const target = requested
    ? inputs.find((f) => f.name === safeFileName(requested))
    : inputs[0];
  if (!target) return apiError("not-found", "File not found", 404);

  // Keep the resolved path inside the task folder.
  const resolved = path.resolve(target.path);
  if (!resolved.startsWith(path.resolve(inputDir(id)) + path.sep)) {
    return apiError("bad-request", "Invalid file name", 400);
  }

  try {
    const data = await readFile(resolved);
    // A4 at 72dpi is 595pt wide; scale dpi so the output lands near `width`.
    const dpi = Math.min(200, Math.max(24, (width / 595) * 72));
    const rendered = await renderPage(
      { data },
      pageNumber,
      { dpi, format: "jpeg", quality: 80, maxEdge: 1600 },
    );

    return new Response(new Uint8Array(rendered.buffer), {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(rendered.buffer.byteLength),
        // Task ids are single-use, so the render is safe to cache hard.
        "Cache-Control": "private, max-age=3600",
        "X-Page-Width": String(rendered.width),
        "X-Page-Height": String(rendered.height),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Render failed";
    return apiError("processing-failed", message, 500);
  }
}
