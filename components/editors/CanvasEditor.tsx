"use client";

import { useCallback, useRef, useState } from "react";
import {
  Circle,
  Highlighter,
  Minus,
  MousePointer2,
  PenLine,
  Square,
  TextCursorInput,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";

import { useT } from "@/components/i18n/LocaleProvider";
import { previewUrl } from "@/lib/client/api";

export type EditorTool =
  | "select"
  | "text"
  | "rect"
  | "ellipse"
  | "line"
  | "freehand"
  | "highlight";

export interface CanvasItem {
  id: string;
  type: Exclude<EditorTool, "select">;
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: { x: number; y: number }[];
  text?: string;
  fontSize?: number;
  color?: string;
  fill?: string;
  opacity?: number;
  strokeWidth?: number;
}

/** Form-field variant, reusing the same placement mechanics. */
export interface FormFieldItem {
  id: string;
  type: "text" | "checkbox" | "radio" | "dropdown";
  name: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Flattened view of either item kind, purely for drawing the overlay. */
interface RenderItem {
  id: string;
  type: string;
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: { x: number; y: number }[];
  text?: string;
  color?: string;
  fill?: string;
}

interface Props {
  taskId: string;
  fileName: string;
  pageCount: number;
  mode: "annotate" | "forms";
  items: (CanvasItem | FormFieldItem)[];
  onChange: (items: (CanvasItem | FormFieldItem)[]) => void;
}

const ANNOTATE_TOOLS: { id: EditorTool; icon: typeof Square; labelKey: keyof ReturnType<typeof useT>["edit"] }[] = [
  { id: "select", icon: MousePointer2, labelKey: "toolSelect" },
  { id: "text", icon: Type, labelKey: "toolText" },
  { id: "freehand", icon: PenLine, labelKey: "toolDraw" },
  { id: "highlight", icon: Highlighter, labelKey: "toolHighlight" },
  { id: "rect", icon: Square, labelKey: "toolRect" },
  { id: "ellipse", icon: Circle, labelKey: "toolEllipse" },
  { id: "line", icon: Minus, labelKey: "toolLine" },
];

const FORM_TOOLS = ["text", "checkbox", "radio", "dropdown"] as const;

let counter = 0;
const nextId = () => `a${++counter}`;

export function CanvasEditor({ taskId, fileName, pageCount, mode, items, onChange }: Props) {
  const t = useT();
  const [tool, setTool] = useState<EditorTool>(mode === "forms" ? "rect" : "text");
  const [fieldType, setFieldType] = useState<(typeof FORM_TOOLS)[number]>("text");
  const [color, setColor] = useState("#e11d48");
  const [page, setPage] = useState(1);

  const surfaceRef = useRef<HTMLDivElement>(null);
  const drawing = useRef<{ startX: number; startY: number; item: CanvasItem } | null>(null);
  const [draft, setDraft] = useState<CanvasItem | null>(null);

  /** Pointer position as a fraction of the rendered page. */
  const fractionFrom = useCallback((event: React.PointerEvent) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  }, []);

  const pointerDown = (event: React.PointerEvent) => {
    if (mode === "annotate" && tool === "select") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = fractionFrom(event);

    if (mode === "forms") {
      drawing.current = {
        startX: point.x,
        startY: point.y,
        item: { id: nextId(), type: "rect", page, x: point.x, y: point.y, width: 0, height: 0 },
      };
      setDraft(drawing.current.item);
      return;
    }

    if (tool === "text") {
      const value = window.prompt(t.edit.textPrompt);
      if (!value) return;
      onChange([
        ...items,
        {
          id: nextId(),
          type: "text",
          page,
          x: point.x,
          y: point.y,
          text: value,
          fontSize: 14,
          color,
        } as CanvasItem,
      ]);
      return;
    }

    const item: CanvasItem = {
      id: nextId(),
      type: tool as Exclude<EditorTool, "select">,
      page,
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
      color,
      strokeWidth: 2,
      ...(tool === "highlight" ? { fill: "#fde047", opacity: 0.35 } : {}),
      ...(tool === "freehand" || tool === "line" ? { points: [point] } : {}),
    };

    drawing.current = { startX: point.x, startY: point.y, item };
    setDraft(item);
  };

  const pointerMove = (event: React.PointerEvent) => {
    if (!drawing.current) return;
    const point = fractionFrom(event);
    const { startX, startY, item } = drawing.current;

    const updated: CanvasItem =
      item.type === "freehand"
        ? { ...item, points: [...(item.points ?? []), point] }
        : item.type === "line"
          ? { ...item, points: [{ x: startX, y: startY }, point] }
          : {
              ...item,
              x: Math.min(startX, point.x),
              y: Math.min(startY, point.y),
              width: Math.abs(point.x - startX),
              height: Math.abs(point.y - startY),
            };

    drawing.current.item = updated;
    setDraft(updated);
  };

  const pointerUp = () => {
    const current = drawing.current?.item;
    drawing.current = null;
    setDraft(null);
    if (!current) return;

    // Ignore accidental taps that produced no shape.
    const tiny =
      current.type !== "freehand" &&
      current.type !== "line" &&
      (current.width ?? 0) < 0.005 &&
      (current.height ?? 0) < 0.005;
    if (tiny) return;

    if (mode === "forms") {
      const field: FormFieldItem = {
        id: current.id,
        type: fieldType,
        name: `${fieldType}_${items.length + 1}`,
        page: current.page,
        x: current.x,
        y: current.y,
        width: Math.max(0.04, current.width ?? 0.15),
        height: Math.max(0.015, current.height ?? 0.03),
      };
      onChange([...items, field]);
      return;
    }

    onChange([...items, current]);
  };

  const pageItems = items.filter((i) => i.page === page);
  const undo = () => onChange(items.slice(0, -1));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {mode === "annotate"
          ? ANNOTATE_TOOLS.map(({ id, icon: Icon, labelKey }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTool(id)}
                aria-pressed={tool === id}
                title={t.edit[labelKey]}
                className={`btn size-9 border ${
                  tool === id
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-line hover:bg-surface text-fg-muted"
                }`}
              >
                <Icon className="size-4" aria-hidden="true" />
              </button>
            ))
          : FORM_TOOLS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setFieldType(id)}
                aria-pressed={fieldType === id}
                className={`btn h-9 border px-3 text-xs ${
                  fieldType === id
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-line hover:bg-surface text-fg-muted"
                }`}
              >
                <TextCursorInput className="size-3.5" aria-hidden="true" />
                {t.edit[`field_${id}` as keyof typeof t.edit]}
              </button>
            ))}

        {mode === "annotate" && (
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            aria-label={t.opt.color}
            className="border-line size-9 cursor-pointer rounded-lg border bg-transparent p-0.5"
          />
        )}

        <span className="mx-1 h-6 w-px bg-[var(--line)]" />

        <button
          type="button"
          onClick={undo}
          disabled={items.length === 0}
          className="btn border-line hover:bg-surface text-fg-muted h-9 border px-3 text-xs"
        >
          <Undo2 className="size-3.5" aria-hidden="true" />
          {t.edit.undo}
        </button>
        <button
          type="button"
          onClick={() => onChange([])}
          disabled={items.length === 0}
          className="btn border-line text-fg-muted h-9 border px-3 text-xs hover:bg-rose-500 hover:text-white"
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          {t.edit.clearAll}
        </button>

        <span className="text-fg-subtle ml-auto text-xs">
          {items.length} {t.edit.itemCount}
        </span>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="btn border-line hover:bg-surface h-8 border px-2.5 text-xs"
        >
          ←
        </button>
        <span className="text-fg-muted text-xs tabular-nums">
          {t.common.page} {page} / {pageCount}
        </span>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          disabled={page >= pageCount}
          className="btn border-line hover:bg-surface h-8 border px-2.5 text-xs"
        >
          →
        </button>
      </div>

      <div className="bg-surface flex justify-center rounded-xl p-4">
        <div
          ref={surfaceRef}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          className="relative max-w-full touch-none bg-white shadow-md"
          style={{ cursor: tool === "select" && mode === "annotate" ? "default" : "crosshair" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl(taskId, fileName, page, 900)}
            alt={`${t.common.page} ${page}`}
            className="pointer-events-none block max-h-[70vh] w-auto max-w-full select-none"
            draggable={false}
          />

          <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
            {[...pageItems, ...(draft ? [draft] : [])].map((raw) => {
              const item = raw as RenderItem;
              const pct = (v: number) => `${v * 100}%`;

              if (mode === "forms" || item.type === "rect" || item.type === "highlight") {
                const isForm = mode === "forms";
                return (
                  <rect
                    key={item.id}
                    x={pct(item.x)}
                    y={pct(item.y)}
                    width={pct(item.width ?? 0)}
                    height={pct(item.height ?? 0)}
                    fill={
                      isForm
                        ? "rgba(37,99,235,0.14)"
                        : item.type === "highlight"
                          ? item.fill ?? "#fde047"
                          : "none"
                    }
                    fillOpacity={item.type === "highlight" ? 0.35 : 1}
                    stroke={isForm ? "#2563eb" : item.color ?? "#e11d48"}
                    strokeWidth={2}
                    strokeDasharray={isForm ? "5 3" : undefined}
                  />
                );
              }

              if (item.type === "ellipse") {
                return (
                  <ellipse
                    key={item.id}
                    cx={pct(item.x + (item.width ?? 0) / 2)}
                    cy={pct(item.y + (item.height ?? 0) / 2)}
                    rx={pct((item.width ?? 0) / 2)}
                    ry={pct((item.height ?? 0) / 2)}
                    fill="none"
                    stroke={item.color ?? "#e11d48"}
                    strokeWidth={2}
                  />
                );
              }

              if (item.type === "freehand" || item.type === "line") {
                const points = (item.points ?? [])
                  .map((p) => `${p.x * 100},${p.y * 100}`)
                  .join(" ");
                return (
                  <polyline
                    key={item.id}
                    points={points}
                    fill="none"
                    stroke={item.color ?? "#e11d48"}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    style={{ transform: "scale(0.01)", transformOrigin: "0 0" }}
                  />
                );
              }

              if (item.type === "text") {
                return (
                  <text
                    key={item.id}
                    x={pct(item.x)}
                    y={pct(item.y)}
                    fill={item.color ?? "#e11d48"}
                    fontSize={14}
                    dominantBaseline="hanging"
                  >
                    {item.text}
                  </text>
                );
              }

              return null;
            })}
          </svg>

          {mode === "forms" &&
            pageItems.map((raw) => {
              const field = raw as FormFieldItem;
              return (
                <span
                  key={field.id}
                  className="pointer-events-none absolute text-[10px] font-semibold text-blue-700"
                  style={{ left: `${field.x * 100}%`, top: `calc(${field.y * 100}% - 14px)` }}
                >
                  {field.name}
                </span>
              );
            })}
        </div>
      </div>

      <p className="text-fg-subtle mt-3 text-[11px] leading-relaxed">
        {mode === "forms" ? t.edit.formsHint : t.edit.annotateHint}
      </p>
    </div>
  );
}
