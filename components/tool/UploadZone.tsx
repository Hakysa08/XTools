"use client";

import { useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Plus, Upload } from "lucide-react";

import { useT } from "@/components/i18n/LocaleProvider";
import { format } from "@/lib/i18n";
import { formatBytes } from "@/lib/site";
import { dropzoneAccept, type ToolDef } from "@/lib/tools/registry";

interface Props {
  tool: ToolDef;
  onFiles: (files: File[]) => void;
  onReject: (message: string) => void;
  /** Compact variant shown once files are already selected. */
  compact?: boolean;
}

export function UploadZone({ tool, onFiles, onReject, compact = false }: Props) {
  const t = useT();

  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      if (rejected.length > 0) {
        const first = rejected[0];
        const tooBig = first.errors.some((e) => e.code === "file-too-large");
        onReject(
          tooBig
            ? format(t.workspace.fileTooLarge, {
                name: first.file.name,
                max: formatBytes(tool.maxBytes),
              })
            : format(t.workspace.wrongType, { name: first.file.name }),
        );
      }
      if (accepted.length > 0) onFiles(accepted);
    },
    [onFiles, onReject, t, tool.maxBytes],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: dropzoneAccept(tool.accept),
    multiple: tool.multiple,
    maxSize: tool.maxBytes,
    maxFiles: tool.multiple ? tool.maxFiles : 1,
    noClick: true,
    noKeyboard: true,
  });

  if (compact) {
    return (
      <div {...getRootProps()} className="contents">
        <input {...getInputProps()} />
        <button
          type="button"
          onClick={open}
          className="border-line-strong text-fg-muted hover:border-brand-600 hover:text-brand-600 flex aspect-3/4 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors"
        >
          <Plus className="size-7" aria-hidden="true" />
          <span className="px-2 text-center text-xs font-medium">{t.workspace.selectMore}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      data-cat={tool.category}
      className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-16 text-center transition-colors sm:py-20 ${
        isDragActive
          ? "cat-ring bg-surface"
          : "border-line-strong hover:border-brand-500 bg-elevated"
      }`}
    >
      <input {...getInputProps()} />

      <span className="brand-gradient mb-6 grid size-16 place-items-center rounded-2xl shadow-md">
        <Upload className="size-7 text-white" aria-hidden="true" />
      </span>

      <button
        type="button"
        onClick={open}
        className="btn brand-gradient h-13 px-8 text-base text-white hover:opacity-90"
      >
        {tool.multiple ? t.workspace.dropTitleMultiple : t.workspace.dropTitle}
      </button>

      <p className="text-fg-muted mt-4 text-sm">
        {isDragActive ? t.workspace.dropActive : t.workspace.dropHint}
      </p>

      <p className="text-fg-subtle mt-6 text-xs">
        {tool.accept.ext.join(", ")} · {formatBytes(tool.maxBytes)}
        {tool.multiple ? ` · ${format(t.workspace.maxFiles, { n: tool.maxFiles })}` : ""}
      </p>
    </div>
  );
}
