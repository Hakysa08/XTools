import { apiError, apiOk } from "@/lib/server/api";
import { loadPdf } from "@/lib/pdf/document";
import { checkRateLimit, clientKey } from "@/lib/server/ratelimit";
import {
  extensionOf,
  isValidTaskId,
  listInputs,
  readManifest,
  saveInput,
  writeManifest,
} from "@/lib/server/storage";
import { getTool } from "@/lib/tools/registry";
import { formatBytes } from "@/lib/site";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limit = checkRateLimit(clientKey(req));
  if (!limit.ok) {
    return apiError("rate-limited", "Too many requests", 429, { retryAfter: limit.retryAfter });
  }

  const { id } = await params;
  if (!isValidTaskId(id)) return apiError("bad-request", "Invalid task id", 400);

  const manifest = await readManifest(id);
  if (!manifest) return apiError("not-found", "Task not found or expired", 404);

  const tool = getTool(manifest.tool);
  if (!tool) return apiError("bad-request", "Unknown tool", 400);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError("bad-request", "Expected multipart form data", 400);
  }

  const entries = form.getAll("files").filter((v): v is File => v instanceof File);
  if (entries.length === 0) return apiError("no-files", "No files were uploaded", 400);

  const existing = await listInputs(id);
  if (existing.length + entries.length > tool.maxFiles) {
    return apiError("bad-request", `This tool accepts up to ${tool.maxFiles} files`, 400, {
      maxFiles: tool.maxFiles,
    });
  }

  const saved: { name: string; size: number; pages?: number }[] = [];

  for (const file of entries) {
    if (file.size > tool.maxBytes) {
      return apiError("too-large", `"${file.name}" exceeds ${formatBytes(tool.maxBytes)}`, 413, {
        maxBytes: tool.maxBytes,
        name: file.name,
      });
    }

    // Extension is the authoritative check — browsers report MIME inconsistently.
    const ext = extensionOf(file.name);
    if (!tool.accept.ext.includes(ext)) {
      return apiError("unsupported-type", `"${file.name}" is not supported by this tool`, 415, {
        name: file.name,
        accepted: tool.accept.ext,
      });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await saveInput(id, file.name, buffer);

    // The visual editors need a page count up front to lay out their thumbnails.
    let pages: number | undefined;
    if (ext === ".pdf" && tool.editor) {
      try {
        const doc = await loadPdf(buffer, { ignoreEncryption: true });
        pages = doc.getPageCount();
      } catch {
        // A file that cannot be parsed will fail later with a clearer message.
      }
    }

    saved.push({ name: stored.name, size: stored.size, pages });
  }

  manifest.inputs = [...manifest.inputs, ...saved];
  await writeManifest(manifest);

  return apiOk({ files: saved, total: manifest.inputs.length });
}
