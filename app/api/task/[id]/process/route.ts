import { apiError, apiOk, errorFromException } from "@/lib/server/api";
import { checkRateLimit, clientKey } from "@/lib/server/ratelimit";
import {
  isValidTaskId,
  listInputs,
  outputDir,
  readManifest,
  writeManifest,
  type StoredFile,
} from "@/lib/server/storage";
import { getProcessor } from "@/lib/tools/processors";
import { getTool } from "@/lib/tools/registry";
import { getToolSchema } from "@/lib/tools/schemas";

export const runtime = "nodejs";
export const maxDuration = 300;

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
  if (tool.status !== "live") {
    return apiError("not-implemented", "This tool is not available yet", 501);
  }

  let body: { files?: string[]; options?: unknown } = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    return apiError("bad-request", "Expected a JSON body", 400);
  }

  const parsed = getToolSchema(tool.slug).safeParse(body.options ?? {});
  if (!parsed.success) {
    return apiError("bad-request", "Invalid options", 400, {
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }

  const stored = await listInputs(id);
  if (stored.length < tool.minFiles) {
    return apiError("no-files", `This tool needs at least ${tool.minFiles} file(s)`, 400, {
      minFiles: tool.minFiles,
    });
  }

  const inputs = orderInputs(stored, body.files);

  const processor = await getProcessor(tool.processor);
  if (!processor) {
    return apiError("not-implemented", `No processor registered for "${tool.processor}"`, 501);
  }

  try {
    const result = await processor({
      taskId: id,
      tool,
      inputs,
      options: parsed.data as Record<string, unknown>,
      outputDir: outputDir(id),
    });

    if (result.outputs.length === 0) {
      return apiError("processing-failed", "The tool produced no output", 500);
    }

    manifest.outputs = result.outputs;
    manifest.stats = result.stats;
    await writeManifest(manifest);

    return apiOk({
      outputs: result.outputs,
      stats: result.stats ?? {},
      output: tool.output,
      /** Multiple files are always delivered as a single ZIP. */
      zip: result.outputs.length > 1,
    });
  } catch (err) {
    return errorFromException(err);
  }
}

/** Applies the client's requested order, keeping any files it did not mention. */
function orderInputs(stored: StoredFile[], requested?: string[]): StoredFile[] {
  if (!requested?.length) return stored;

  const remaining = new Map(stored.map((f) => [f.name, f]));
  const ordered: StoredFile[] = [];

  for (const name of requested) {
    const match = remaining.get(name);
    if (match) {
      ordered.push(match);
      remaining.delete(name);
    }
  }
  return [...ordered, ...remaining.values()];
}
