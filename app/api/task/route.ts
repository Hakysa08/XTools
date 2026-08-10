import { apiError, apiOk } from "@/lib/server/api";
import { checkRateLimit, clientKey } from "@/lib/server/ratelimit";
import { createTask } from "@/lib/server/storage";
import { getTool } from "@/lib/tools/registry";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const limit = checkRateLimit(clientKey(req));
  if (!limit.ok) {
    return apiError("rate-limited", "Too many requests", 429, { retryAfter: limit.retryAfter });
  }

  let body: { tool?: string };
  try {
    body = await req.json();
  } catch {
    return apiError("bad-request", "Expected a JSON body", 400);
  }

  const tool = body.tool ? getTool(body.tool) : undefined;
  if (!tool) return apiError("bad-request", "Unknown tool", 400);
  if (tool.status !== "live") {
    return apiError("not-implemented", "This tool is not available yet", 501);
  }

  const id = await createTask(tool.slug);
  return apiOk({ taskId: id, tool: tool.slug });
}
