"use client";

import Link from "next/link";
import { Check, Download, RotateCcw } from "lucide-react";

import { useT } from "@/components/i18n/LocaleProvider";
import { downloadUrl, type ProcessResponse } from "@/lib/client/api";
import { format } from "@/lib/i18n";
import { formatBytes } from "@/lib/site";
import type { ToolDef } from "@/lib/tools/registry";

interface Props {
  tool: ToolDef;
  taskId: string;
  result: ProcessResponse;
  onReset: () => void;
}

export function ResultPanel({ tool, taskId, result, onReset }: Props) {
  const t = useT();
  const multiple = result.outputs.length > 1;

  const originalSize = Number(result.stats.originalSize ?? 0);
  const newSize = Number(result.stats.newSize ?? 0);
  const showSavings = originalSize > 0 && newSize > 0;
  const savedPercent = showSavings ? Math.round((1 - newSize / originalSize) * 100) : 0;

  return (
    <div className="card mx-auto flex max-w-lg flex-col items-center px-8 py-12 text-center">
      <span className="mb-5 grid size-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-500">
        <Check className="size-7" aria-hidden="true" />
      </span>

      <h2 className="text-xl font-bold">{t.workspace.done}</h2>

      {showSavings && (
        <div className="text-fg-muted mt-4 text-sm">
          {savedPercent > 0 ? (
            <p className="font-semibold text-emerald-500">
              {format(t.workspace.savings, { percent: `${savedPercent}%` })}
            </p>
          ) : (
            <p>{t.workspace.noSavings}</p>
          )}
          <p className="mt-1 tabular-nums">
            {formatBytes(originalSize)} → {formatBytes(newSize)}
          </p>
        </div>
      )}

      {!showSavings && result.stats.pages !== undefined && (
        <p className="text-fg-muted mt-3 text-sm">
          {format(t.workspace.pages, { n: Number(result.stats.pages) })}
        </p>
      )}

      <a
        href={downloadUrl(taskId)}
        download
        className="btn brand-gradient mt-8 h-13 w-full px-8 text-base text-white hover:opacity-90"
      >
        <Download className="size-5" aria-hidden="true" />
        {multiple ? t.workspace.downloadZip : t.workspace.downloadFile}
      </a>

      {multiple && (
        <ul className="mt-5 w-full space-y-1.5 text-left">
          {result.outputs.slice(0, 8).map((file) => (
            <li key={file.name} className="flex items-center justify-between gap-3 text-sm">
              <a
                href={downloadUrl(taskId, file.name)}
                download
                className="text-fg-muted hover:text-brand-600 truncate transition-colors"
                title={file.name}
              >
                {file.name}
              </a>
              <span className="text-fg-subtle shrink-0 text-xs tabular-nums">
                {formatBytes(file.size)}
              </span>
            </li>
          ))}
          {result.outputs.length > 8 && (
            <li className="text-fg-subtle text-xs">+{result.outputs.length - 8}</li>
          )}
        </ul>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
        <button
          type="button"
          onClick={onReset}
          className="text-fg-muted hover:text-fg inline-flex items-center gap-1.5 font-medium transition-colors"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          {t.workspace.startOver}
        </button>
        <Link href="/" className="text-brand-600 font-medium hover:underline">
          {t.home.heroCtaPrimary}
        </Link>
      </div>

      <p className="text-fg-subtle mt-6 text-xs">{tool.accept.ext.join(", ")}</p>
    </div>
  );
}
