import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { degrees } from "@cantoo/pdf-lib";

import { copyPagesInto, createPdf, loadPdf, normalizeRotation, savePdf } from "@/lib/pdf/document";
import { invertPages, parsePageRange, toContiguousRanges } from "@/lib/pdf/pages";
import { numbered } from "@/lib/pdf/zip";
import { stripExtension, writeOutput } from "@/lib/server/storage";
import type { ProcessContext, ProcessResult } from "./types";

async function openFirstInput(ctx: ProcessContext) {
  const input = ctx.inputs[0];
  const data = await readFile(input.path);
  const doc = await loadPdf(data, { ignoreEncryption: true });
  return { doc, data, baseName: stripExtension(path.basename(input.name)) };
}

/** Builds a new document containing only `pages` (1-based), in that order. */
async function subsetOf(source: Awaited<ReturnType<typeof loadPdf>>, pages: number[]) {
  const out = await createPdf();
  await copyPagesInto(out, source, pages);
  return out;
}

// ---------------------------------------------------------------- split

export async function split(ctx: ProcessContext): Promise<ProcessResult> {
  const { doc, baseName } = await openFirstInput(ctx);
  const total = doc.getPageCount();

  const mode = (ctx.options.mode as string) ?? "ranges";
  const outputs: { name: string; size: number }[] = [];

  /** Each entry becomes one output PDF. */
  let groups: number[][] = [];

  if (mode === "every") {
    const size = Math.max(1, Number(ctx.options.everyN ?? 1));
    for (let start = 1; start <= total; start += size) {
      const group: number[] = [];
      for (let p = start; p < start + size && p <= total; p += 1) group.push(p);
      groups.push(group);
    }
  } else if (mode === "all") {
    groups = Array.from({ length: total }, (_, i) => [i + 1]);
  } else {
    // "ranges": each comma-separated run becomes its own file.
    const selected = parsePageRange(String(ctx.options.pages ?? ""), total);
    const mergeIntoOne = ctx.options.merge === true;
    if (mergeIntoOne) {
      groups = [selected];
    } else {
      groups = toContiguousRanges(selected).map(([from, to]) => {
        const group: number[] = [];
        for (let p = from; p <= to; p += 1) group.push(p);
        return group;
      });
    }
  }

  groups = groups.filter((g) => g.length > 0);
  if (groups.length === 0) {
    groups = [Array.from({ length: total }, (_, i) => i + 1)];
  }

  for (let i = 0; i < groups.length; i += 1) {
    const group = groups[i];
    const out = await subsetOf(doc, group);
    const bytes = await savePdf(out);
    const label =
      group.length === 1
        ? `${group[0]}`
        : `${group[0]}-${group[group.length - 1]}`;
    const name =
      groups.length === 1
        ? `${baseName}-split.pdf`
        : `${baseName}-${numbered(i + 1, groups.length)}-pages-${label}.pdf`;
    const file = await writeOutput(ctx.taskId, name, bytes);
    outputs.push({ name: file.name, size: file.size });
  }

  return { outputs, stats: { pages: total, parts: groups.length } };
}

// ------------------------------------------------------- remove / extract

export async function removePages(ctx: ProcessContext): Promise<ProcessResult> {
  const { doc, baseName } = await openFirstInput(ctx);
  const total = doc.getPageCount();

  const toRemove = parsePageRange(String(ctx.options.pages ?? ""), total);
  const kept = invertPages(toRemove, total);

  if (kept.length === 0) {
    throw new Error("Removing every page would leave an empty document");
  }

  const out = await subsetOf(doc, kept);
  const bytes = await savePdf(out);
  const file = await writeOutput(ctx.taskId, `${baseName}-removed.pdf`, bytes);

  return {
    outputs: [{ name: file.name, size: file.size }],
    stats: { pages: kept.length, removed: toRemove.length },
  };
}

export async function extractPages(ctx: ProcessContext): Promise<ProcessResult> {
  const { doc, baseName } = await openFirstInput(ctx);
  const total = doc.getPageCount();

  const selected = parsePageRange(String(ctx.options.pages ?? ""), total);
  if (selected.length === 0) throw new Error("No pages selected");

  // "separate" writes one file per page instead of a single combined document.
  if (ctx.options.separate === true) {
    const outputs: { name: string; size: number }[] = [];
    for (let i = 0; i < selected.length; i += 1) {
      const out = await subsetOf(doc, [selected[i]]);
      const bytes = await savePdf(out);
      const file = await writeOutput(
        ctx.taskId,
        `${baseName}-page-${numbered(selected[i], total)}.pdf`,
        bytes,
      );
      outputs.push({ name: file.name, size: file.size });
    }
    return { outputs, stats: { pages: selected.length } };
  }

  const out = await subsetOf(doc, selected);
  const bytes = await savePdf(out);
  const file = await writeOutput(ctx.taskId, `${baseName}-extracted.pdf`, bytes);

  return {
    outputs: [{ name: file.name, size: file.size }],
    stats: { pages: selected.length },
  };
}

// ------------------------------------------------------------- organize

export interface PageOp {
  /** 1-based index in the source document. */
  page: number;
  rotate?: number;
}

/**
 * Rebuilds a document from an explicit page list, applying per-page rotation.
 * Reordering, duplicating and deleting all fall out of the supplied order.
 */
export async function organize(ctx: ProcessContext): Promise<ProcessResult> {
  const { doc, baseName } = await openFirstInput(ctx);
  const total = doc.getPageCount();

  const rawOps = Array.isArray(ctx.options.pages) ? (ctx.options.pages as PageOp[]) : [];
  const ops = rawOps.filter((op) => op.page >= 1 && op.page <= total);

  if (ops.length === 0) throw new Error("No pages left in the document");

  const out = await createPdf();
  const copied = await out.copyPages(
    doc,
    ops.map((op) => op.page - 1),
  );

  copied.forEach((page, i) => {
    const extra = ops[i].rotate ?? 0;
    if (extra) {
      const current = page.getRotation().angle;
      page.setRotation(degrees(normalizeRotation(current + extra)));
    }
    out.addPage(page);
  });

  const bytes = await savePdf(out);
  const file = await writeOutput(ctx.taskId, `${baseName}-organized.pdf`, bytes);

  return {
    outputs: [{ name: file.name, size: file.size }],
    stats: { pages: ops.length, originalPages: total },
  };
}

// --------------------------------------------------------------- rotate

export async function rotate(ctx: ProcessContext): Promise<ProcessResult> {
  const outputs: { name: string; size: number }[] = [];
  const turn = Number(ctx.options.rotation ?? 90);
  const spec = String(ctx.options.pages ?? "");
  /** Per-page overrides from the visual editor, keyed by 1-based page number. */
  const perPage = (ctx.options.perPage as Record<string, number> | undefined) ?? undefined;

  let totalRotated = 0;

  for (const input of ctx.inputs) {
    const data = await readFile(input.path);
    const doc = await loadPdf(data, { ignoreEncryption: true });
    const total = doc.getPageCount();
    const targets = perPage ? null : parsePageRange(spec, total);

    doc.getPages().forEach((page, i) => {
      const pageNo = i + 1;
      const delta = perPage ? (perPage[String(pageNo)] ?? 0) : targets!.includes(pageNo) ? turn : 0;
      if (!delta) return;
      const current = page.getRotation().angle;
      page.setRotation(degrees(normalizeRotation(current + delta)));
      totalRotated += 1;
    });

    const bytes = await savePdf(doc);
    const baseName = stripExtension(path.basename(input.name));
    const file = await writeOutput(ctx.taskId, `${baseName}-rotated.pdf`, bytes);
    outputs.push({ name: file.name, size: file.size });
  }

  return { outputs, stats: { rotated: totalRotated, files: ctx.inputs.length } };
}
