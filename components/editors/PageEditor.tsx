"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, GripVertical, RotateCcw, RotateCw, Trash2, Undo2 } from "lucide-react";

import { useT } from "@/components/i18n/LocaleProvider";
import { previewUrl } from "@/lib/client/api";

export interface EditorPage {
  /** Unique per tile, since a page can be duplicated. */
  key: string;
  /** 1-based page in the uploaded document. */
  page: number;
  rotate: number;
}

interface Props {
  taskId: string;
  fileName: string;
  pageCount: number;
  pages: EditorPage[];
  onChange: (pages: EditorPage[]) => void;
}

export function buildInitialPages(pageCount: number): EditorPage[] {
  return Array.from({ length: pageCount }, (_, i) => ({
    key: `p${i + 1}`,
    page: i + 1,
    rotate: 0,
  }));
}

export function PageEditor({ taskId, fileName, pageCount, pages, onChange }: Props) {
  const t = useT();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  // Seed the tiles once the page count is known.
  useEffect(() => {
    if (pages.length === 0 && pageCount > 0) onChange(buildInitialPages(pageCount));
  }, [pageCount, pages.length, onChange]);

  const update = useCallback(
    (index: number, patch: Partial<EditorPage>) => {
      onChange(pages.map((p, i) => (i === index ? { ...p, ...patch } : p)));
    },
    [pages, onChange],
  );

  const remove = (index: number) => onChange(pages.filter((_, i) => i !== index));

  const duplicate = (index: number) => {
    const copy = { ...pages[index], key: `${pages[index].key}-c${Date.now()}` };
    const next = [...pages];
    next.splice(index + 1, 0, copy);
    onChange(next);
  };

  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = [...pages];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  const rotateAll = (delta: number) =>
    onChange(pages.map((p) => ({ ...p, rotate: (p.rotate + delta + 360) % 360 })));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => rotateAll(-90)}
          className="btn border-line hover:bg-surface h-9 border px-3 text-xs"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          {t.opt.rotate270}
        </button>
        <button
          type="button"
          onClick={() => rotateAll(90)}
          className="btn border-line hover:bg-surface h-9 border px-3 text-xs"
        >
          <RotateCw className="size-3.5" aria-hidden="true" />
          {t.opt.rotate90}
        </button>
        <button
          type="button"
          onClick={() => onChange(buildInitialPages(pageCount))}
          className="btn text-fg-muted hover:text-fg h-9 px-2 text-xs"
        >
          <Undo2 className="size-3.5" aria-hidden="true" />
          {t.common.reset}
        </button>
        <span className="text-fg-subtle ml-auto text-xs">
          {pages.length} / {pageCount}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {pages.map((page, index) => (
          <div
            key={page.key}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragEnd={() => {
              setDragIndex(null);
              setOverIndex(null);
            }}
            onDragOver={(e) => {
              if (dragIndex === null) return;
              e.preventDefault();
              setOverIndex(index);
            }}
            onDrop={(e) => {
              if (dragIndex === null) return;
              e.preventDefault();
              move(dragIndex, index);
              setDragIndex(null);
              setOverIndex(null);
            }}
            className={`card group relative cursor-grab overflow-hidden active:cursor-grabbing ${
              dragIndex === index ? "opacity-40" : ""
            } ${overIndex === index && dragIndex !== index ? "border-brand-600 ring-brand-600 ring-2" : ""}`}
          >
            <div className="bg-surface flex aspect-3/4 items-center justify-center overflow-hidden p-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl(taskId, fileName, page.page, 240)}
                alt={`${t.common.page} ${page.page}`}
                loading="lazy"
                className="max-h-full max-w-full bg-white shadow-sm transition-transform duration-200"
                style={{ transform: `rotate(${page.rotate}deg)` }}
              />
            </div>

            <div className="border-line text-fg-subtle flex items-center justify-between border-t px-2 py-1.5">
              <span className="flex items-center gap-1 text-[11px] font-medium">
                <GripVertical className="size-3" aria-hidden="true" />
                {index + 1}
              </span>
              <span className="text-[10px] tabular-nums">
                {page.page !== index + 1 ? `←${page.page}` : ""}
              </span>
            </div>

            <div className="bg-elevated/95 absolute inset-x-0 top-0 flex justify-center gap-1 p-1.5 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                onClick={() => update(index, { rotate: (page.rotate + 270) % 360 })}
                aria-label={t.opt.rotate270}
                className="btn hover:bg-surface text-fg-muted hover:text-fg size-7"
              >
                <RotateCcw className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => update(index, { rotate: (page.rotate + 90) % 360 })}
                aria-label={t.opt.rotate90}
                className="btn hover:bg-surface text-fg-muted hover:text-fg size-7"
              >
                <RotateCw className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => duplicate(index)}
                aria-label={t.common.apply}
                className="btn hover:bg-surface text-fg-muted hover:text-fg size-7"
              >
                <Copy className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={t.workspace.removeFile}
                className="btn text-fg-muted size-7 hover:bg-rose-500 hover:text-white"
                disabled={pages.length <= 1}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
