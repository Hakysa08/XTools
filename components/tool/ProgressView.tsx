"use client";

import { LoaderCircle } from "lucide-react";

import { useT } from "@/components/i18n/LocaleProvider";

interface Props {
  phase: "uploading" | "processing";
  /** 0..1, only meaningful while uploading. */
  progress: number;
}

export function ProgressView({ phase, progress }: Props) {
  const t = useT();
  const uploading = phase === "uploading";
  const percent = Math.round(progress * 100);

  return (
    <div className="card mx-auto flex max-w-lg flex-col items-center px-8 py-14 text-center">
      <LoaderCircle className="text-brand-600 animate-spin-slow mb-6 size-11" aria-hidden="true" />

      <p className="text-lg font-semibold">
        {uploading ? t.workspace.uploading : t.workspace.processing}
      </p>

      {uploading ? (
        <>
          <div className="bg-surface mt-6 h-2 w-full overflow-hidden rounded-full">
            <div
              className="brand-gradient h-full rounded-full transition-[width] duration-200 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-fg-subtle mt-2 text-sm tabular-nums">{percent}%</p>
        </>
      ) : (
        <>
          {/* Duration is unknown server-side, so show motion rather than a fake percentage. */}
          <div className="bg-surface mt-6 h-2 w-full overflow-hidden rounded-full">
            <div className="brand-gradient h-full w-1/3 animate-pulse rounded-full" />
          </div>
          <p className="text-fg-muted mt-4 max-w-xs text-sm leading-relaxed">
            {t.workspace.processingHint}
          </p>
        </>
      )}
    </div>
  );
}
