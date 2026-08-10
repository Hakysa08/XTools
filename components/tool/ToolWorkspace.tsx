"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CircleAlert, Trash2 } from "lucide-react";

import { useT } from "@/components/i18n/LocaleProvider";
import { getDefaultOptions, getOptionsPanel } from "@/components/options";
import { PageEditor, type EditorPage } from "@/components/editors/PageEditor";
import { CanvasEditor, type CanvasItem, type FormFieldItem } from "@/components/editors/CanvasEditor";
import { ScanCapture } from "@/components/editors/ScanCapture";
import { FileGrid, type PickedFile } from "@/components/tool/FileGrid";
import { ProgressView } from "@/components/tool/ProgressView";
import { ResultPanel } from "@/components/tool/ResultPanel";
import { UploadZone } from "@/components/tool/UploadZone";
import {
  createTask,
  messageFor,
  processTask,
  uploadFiles,
  type ProcessResponse,
} from "@/lib/client/api";
import { format } from "@/lib/i18n";
import { getToolCopy } from "@/lib/i18n/tools";
import type { ToolDef } from "@/lib/tools/registry";

type Phase = "idle" | "configuring" | "uploading" | "processing" | "done" | "error";

let idCounter = 0;
const nextId = () => `f${++idCounter}`;

/** State for tools that mount a visual editor over the uploaded document. */
interface EditorState {
  taskId: string;
  fileName: string;
  pageCount: number;
}

export function ToolWorkspace({ tool }: { tool: ToolDef }) {
  const t = useT();
  const copy = getToolCopy(t, tool.slug);

  const [phase, setPhase] = useState<Phase>("idle");
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [options, setOptions] = useState<Record<string, unknown>>(() =>
    getDefaultOptions(tool.slug),
  );
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResponse | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorPages, setEditorPages] = useState<EditorPage[]>([]);
  const [canvasItems, setCanvasItems] = useState<(CanvasItem | FormFieldItem)[]>([]);
  const taskIdRef = useRef<string | null>(null);

  const OptionsPanel = getOptionsPanel(tool.slug);
  const usesPageEditor = tool.editor === "organize";
  const usesCamera = tool.editor === "scan";
  const usesCanvas = tool.editor === "canvas" || tool.editor === "forms";

  // Object URLs for the camera thumbnails, revoked when the tiles change.
  const shots = useMemo(
    () => files.map((f) => ({ id: f.id, url: URL.createObjectURL(f.file) })),
    [files],
  );
  useEffect(() => {
    return () => shots.forEach((s) => URL.revokeObjectURL(s.url));
  }, [shots]);

  /**
   * Editors render server-side page thumbnails, so the document has to reach the
   * server before the user can configure anything. Non-editor tools stay lazy
   * and upload only when the action button is pressed.
   */
  const prepareEditor = useCallback(
    async (file: File) => {
      setPhase("uploading");
      setProgress(0);
      try {
        const taskId = await createTask(tool.slug);
        taskIdRef.current = taskId;
        const uploaded = await uploadFiles(taskId, [file], setProgress);
        const first = uploaded[0];
        setEditor({
          taskId,
          fileName: first.name,
          pageCount: first.pages ?? 0,
        });
        setEditorPages([]);
        setPhase("configuring");
      } catch (err) {
        setError(messageFor(t, err));
        setPhase("error");
      }
    },
    [t, tool.slug],
  );

  const addFiles = useCallback(
    (incoming: File[]) => {
      setError(null);
      setFiles((prev) => {
        const next = tool.multiple
          ? [...prev, ...incoming.map((file) => ({ id: nextId(), file }))]
          : [{ id: nextId(), file: incoming[0] }];
        return next.slice(0, tool.maxFiles);
      });

      if ((usesPageEditor || usesCanvas) && incoming[0]) {
        void prepareEditor(incoming[0]);
        return;
      }
      setPhase("configuring");
    },
    [tool.multiple, tool.maxFiles, usesPageEditor, usesCanvas, prepareEditor],
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const next = prev.filter((f) => f.id !== id);
      if (next.length === 0) setPhase("idle");
      return next;
    });
  }, []);

  const reorder = useCallback((from: number, to: number) => {
    setFiles((prev) => {
      if (from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setFiles([]);
    setOptions(getDefaultOptions(tool.slug));
    setProgress(0);
    setError(null);
    setResult(null);
    setEditor(null);
    setEditorPages([]);
    setCanvasItems([]);
    taskIdRef.current = null;
  }, [tool.slug]);

  const run = useCallback(async () => {
    if (files.length < tool.minFiles) {
      setError(format(t.workspace.needMoreFiles, { n: tool.minFiles }));
      return;
    }

    setError(null);
    setProgress(0);

    try {
      let taskId: string;
      let names: string[];

      if (editor) {
        // The editor already uploaded this document; reuse its task.
        taskId = editor.taskId;
        names = [editor.fileName];
      } else {
        setPhase("uploading");
        taskId = await createTask(tool.slug);
        taskIdRef.current = taskId;
        const uploaded = await uploadFiles(
          taskId,
          files.map((f) => f.file),
          setProgress,
        );
        // Stored names can differ from the originals (sanitised / de-duplicated),
        // so pass them back to preserve the user's ordering.
        names = uploaded.map((f) => f.name);
      }

      setPhase("processing");

      let payload: Record<string, unknown> = options;
      if (usesPageEditor) {
        payload = { ...options, pages: editorPages.map((p) => ({ page: p.page, rotate: p.rotate })) };
      } else if (tool.editor === "canvas") {
        payload = { ...options, annotations: canvasItems };
      } else if (tool.editor === "forms") {
        payload = { ...options, fields: canvasItems };
      }

      const response = await processTask(taskId, names, payload);

      setResult(response);
      setPhase("done");
    } catch (err) {
      setError(messageFor(t, err));
      setPhase("error");
    }
  }, [canvasItems, editor, editorPages, files, options, t, tool.editor, tool.minFiles, tool.slug, usesPageEditor]);

  if (phase === "uploading" || phase === "processing") {
    return (
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <ProgressView phase={phase} progress={progress} />
      </section>
    );
  }

  if (phase === "done" && result && taskIdRef.current) {
    return (
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <ResultPanel tool={tool} taskId={taskIdRef.current} result={result} onReset={reset} />
      </section>
    );
  }

  const hasFiles = files.length > 0;
  // Tools like HTML-to-PDF take input other than a file, so their options panel
  // has to be reachable before anything is uploaded.
  const showWorkspace = hasFiles || tool.minFiles === 0 || usesCamera;

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {error && (
        <div
          role="alert"
          className="mx-auto mb-6 flex max-w-3xl items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/8 px-4 py-3 text-sm"
        >
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-rose-500" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-semibold text-rose-500">{t.workspace.errorTitle}</p>
            <p className="text-fg-muted mt-0.5 leading-relaxed">{error}</p>
          </div>
          {phase === "error" && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setPhase(hasFiles ? "configuring" : "idle");
              }}
              className="text-brand-600 shrink-0 text-sm font-semibold hover:underline"
            >
              {t.workspace.tryAgain}
            </button>
          )}
        </div>
      )}

      {!showWorkspace ? (
        <div className="mx-auto max-w-3xl">
          <UploadZone tool={tool} onFiles={addFiles} onReject={setError} />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div>
            {usesCamera ? (
              <ScanCapture onCapture={addFiles} shots={shots} onRemove={removeFile} />
            ) : editor && usesCanvas ? (
              <CanvasEditor
                taskId={editor.taskId}
                fileName={editor.fileName}
                pageCount={editor.pageCount}
                mode={tool.editor === "forms" ? "forms" : "annotate"}
                items={canvasItems}
                onChange={setCanvasItems}
              />
            ) : editor ? (
              <PageEditor
                taskId={editor.taskId}
                fileName={editor.fileName}
                pageCount={editor.pageCount}
                pages={editorPages}
                onChange={setEditorPages}
              />
            ) : hasFiles ? (
              <>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-fg-muted text-sm font-medium">
                    {format(t.workspace.fileCount, { n: files.length })}
                  </p>
                  <button
                    type="button"
                    onClick={reset}
                    className="text-fg-subtle hover:text-fg inline-flex items-center gap-1.5 text-sm transition-colors"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    {t.workspace.clearAll}
                  </button>
                </div>

                <FileGrid
                  tool={tool}
                  files={files}
                  onRemove={removeFile}
                  onReorder={reorder}
                  onAdd={addFiles}
                  onReject={setError}
                  reorderable={tool.multiple && tool.slug === "merge-pdf"}
                />
              </>
            ) : (
              <UploadZone tool={tool} onFiles={addFiles} onReject={setError} />
            )}
          </div>

          <aside className="lg:sticky lg:top-24">
            <div className="card overflow-hidden">
              {OptionsPanel && (
                <div className="border-line border-b p-5">
                  <h2 className="mb-4 text-sm font-bold tracking-wide uppercase">
                    {t.workspace.optionsTitle}
                  </h2>
                  <OptionsPanel
                    tool={tool}
                    files={files}
                    value={options}
                    onChange={(patch) => setOptions((prev) => ({ ...prev, ...patch }))}
                  />
                </div>
              )}

              <div className="p-5">
                <button
                  type="button"
                  onClick={run}
                  disabled={files.length < tool.minFiles}
                  className="btn brand-gradient h-13 w-full px-6 text-base text-white hover:opacity-90"
                >
                  {copy.name}
                  <ArrowRight className="size-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
