import "server-only";
import { readFile } from "node:fs/promises";

import { copyPagesInto, createPdf, loadPdf, savePdf } from "@/lib/pdf/document";
import { writeOutput } from "@/lib/server/storage";
import type { ProcessContext, ProcessResult } from "./types";

export async function merge(ctx: ProcessContext): Promise<ProcessResult> {
  const out = await createPdf();
  let totalPages = 0;

  for (const input of ctx.inputs) {
    const data = await readFile(input.path);
    // Read-only copy, so a protected file can still be merged without its password.
    const src = await loadPdf(data, { ignoreEncryption: true });
    const pageCount = src.getPageCount();
    const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
    await copyPagesInto(out, src, pages);
    totalPages += pageCount;
  }

  const bytes = await savePdf(out);
  const file = await writeOutput(ctx.taskId, "merged.pdf", bytes);

  return {
    outputs: [{ name: file.name, size: file.size }],
    stats: { pages: totalPages, files: ctx.inputs.length },
  };
}
