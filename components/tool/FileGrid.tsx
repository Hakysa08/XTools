"use client";

import { GripVertical, X } from "lucide-react";
import { useState } from "react";

import { useT } from "@/components/i18n/LocaleProvider";
import { formatBytes } from "@/lib/site";
import type { ToolDef } from "@/lib/tools/registry";

import { UploadZone } from "./UploadZone";

export interface PickedFile {
  id: string;
  file: File;
}

interface Props {
  tool: ToolDef;
  files: PickedFile[];
  onRemove: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onAdd: (files: File[]) => void;
  onReject: (message: string) => void;
  /** Merge is the only tool where sequence changes the result. */
  reorderable?: boolean;
}

export function FileGrid({
  tool,
  files,
  onRemove,
  onReorder,
  onAdd,
  onReject,
  reorderable = false,
}: Props) {
  const t = useT();
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const Icon = tool.icon;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {files.map((item, index) => (
        <div
          key={item.id}
          draggable={reorderable}
          onDragStart={() => setDraggingIndex(index)}
          onDragEnd={() => {
            setDraggingIndex(null);
            setOverIndex(null);
          }}
          onDragOver={(e) => {
            if (!reorderable || draggingIndex === null) return;
            e.preventDefault();
            setOverIndex(index);
          }}
          onDrop={(e) => {
            if (!reorderable || draggingIndex === null) return;
            e.preventDefault();
            onReorder(draggingIndex, index);
            setDraggingIndex(null);
            setOverIndex(null);
          }}
          data-cat={tool.category}
          className={`card group relative flex flex-col overflow-hidden transition-all ${
            draggingIndex === index ? "opacity-40" : ""
          } ${overIndex === index && draggingIndex !== index ? "cat-ring ring-2 ring-current" : ""} ${
            reorderable ? "cursor-grab active:cursor-grabbing" : ""
          }`}
        >
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label={t.workspace.removeFile}
            className="bg-elevated/90 border-line text-fg-muted hover:bg-rose-500 hover:text-white absolute top-2 right-2 z-10 grid size-7 place-items-center rounded-full border opacity-0 shadow-sm transition-all group-hover:opacity-100 focus-visible:opacity-100"
          >
            <X className="size-3.5" />
          </button>

          {reorderable && (
            <span className="text-fg-subtle absolute top-2 left-2 z-10 flex items-center gap-0.5">
              <GripVertical className="size-4" aria-hidden="true" />
              <span className="text-xs font-bold">{index + 1}</span>
            </span>
          )}

          <div className="bg-surface flex aspect-3/4 items-center justify-center">
            <Icon className="cat-fg size-10 opacity-60" aria-hidden="true" />
          </div>

          <div className="p-2.5">
            <p className="truncate text-xs font-medium" title={item.file.name}>
              {item.file.name}
            </p>
            <p className="text-fg-subtle mt-0.5 text-[11px]">{formatBytes(item.file.size)}</p>
          </div>
        </div>
      ))}

      {tool.multiple && files.length < tool.maxFiles && (
        <UploadZone tool={tool} onFiles={onAdd} onReject={onReject} compact />
      )}
    </div>
  );
}
