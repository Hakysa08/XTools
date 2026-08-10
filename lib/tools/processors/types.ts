import "server-only";
import type { StoredFile } from "@/lib/server/storage";
import type { ToolDef } from "@/lib/tools/registry";

export interface ProcessContext {
  taskId: string;
  tool: ToolDef;
  /** Input files in the order the client asked for. */
  inputs: StoredFile[];
  /** Already validated against the tool's zod schema. */
  options: Record<string, unknown>;
  outputDir: string;
}

export interface ProcessResult {
  outputs: { name: string; size: number }[];
  /** Extra numbers for the result screen, e.g. bytes saved. */
  stats?: Record<string, number | string>;
}

export type Processor = (ctx: ProcessContext) => Promise<ProcessResult>;
