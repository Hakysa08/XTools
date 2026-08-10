"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Check, RefreshCw, Trash2 } from "lucide-react";

import { useT } from "@/components/i18n/LocaleProvider";

interface Props {
  onCapture: (files: File[]) => void;
  shots: { id: string; url: string }[];
  onRemove: (id: string) => void;
}

/**
 * Camera capture for the Scan to PDF tool. Frames are grabbed to a canvas and
 * lightly processed — grey-world white balance plus a contrast curve — so a
 * phone photo of a document reads more like a scan before it becomes a page.
 */
export function ScanCapture({ onCapture, shots, onRemove }: Props) {
  const t = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enhance, setEnhance] = useState(true);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setActive(false);
  }, []);

  useEffect(() => stop, [stop]);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.scan.cameraError);
    }
  };

  const shoot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    if (enhance) {
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      enhanceScan(image.data);
      ctx.putImageData(image, 0, 0);
    }

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `scan-${Date.now()}.jpg`, { type: "image/jpeg" });
        onCapture([file]);
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <div>
      <div className="border-line bg-surface relative overflow-hidden rounded-xl border">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`aspect-4/3 w-full bg-black object-cover ${active ? "" : "hidden"}`}
        />

        {!active && (
          <div className="flex aspect-4/3 flex-col items-center justify-center px-6 text-center">
            <Camera className="text-fg-subtle mb-3 size-10" aria-hidden="true" />
            <p className="text-fg-muted mb-4 max-w-xs text-sm leading-relaxed">{t.scan.intro}</p>
            <button
              type="button"
              onClick={start}
              className="btn brand-gradient h-10 px-5 text-sm text-white hover:opacity-90"
            >
              <Camera className="size-4" aria-hidden="true" />
              {t.scan.start}
            </button>
            {error && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-rose-500">
                <CameraOff className="size-3.5" aria-hidden="true" />
                {t.scan.cameraError}
              </p>
            )}
          </div>
        )}

        {active && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-gradient-to-t from-black/70 to-transparent p-4">
            <button
              type="button"
              onClick={() => setEnhance((v) => !v)}
              aria-pressed={enhance}
              className={`btn h-9 rounded-full px-3 text-xs backdrop-blur ${
                enhance ? "bg-white text-slate-900" : "bg-black/45 text-white"
              }`}
            >
              {enhance && <Check className="size-3.5" aria-hidden="true" />}
              {t.scan.enhance}
            </button>
            <button
              type="button"
              onClick={shoot}
              aria-label={t.scan.capture}
              className="grid size-14 place-items-center rounded-full border-4 border-white/80 bg-white/25 backdrop-blur transition-transform active:scale-95"
            >
              <span className="size-9 rounded-full bg-white" />
            </button>
            <button
              type="button"
              onClick={stop}
              className="btn h-9 rounded-full bg-black/45 px-3 text-xs text-white backdrop-blur"
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              {t.scan.stop}
            </button>
          </div>
        )}
      </div>

      {shots.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {shots.map((shot, index) => (
            <div key={shot.id} className="card group relative overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shot.url} alt={`${t.common.page} ${index + 1}`} className="aspect-3/4 w-full object-cover" />
              <span className="absolute top-1.5 left-1.5 rounded bg-black/55 px-1.5 text-[10px] font-semibold text-white">
                {index + 1}
              </span>
              <button
                type="button"
                onClick={() => onRemove(shot.id)}
                aria-label={t.workspace.removeFile}
                className="bg-elevated/90 text-fg-muted absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 hover:bg-rose-500 hover:text-white"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Grey-world white balance followed by an S-curve. Lifts paper towards white
 * and pushes ink towards black without the harsh clipping of a hard threshold.
 */
function enhanceScan(data: Uint8ClampedArray): void {
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  const pixels = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    sumR += data[i];
    sumG += data[i + 1];
    sumB += data[i + 2];
  }

  const avgR = sumR / pixels;
  const avgG = sumG / pixels;
  const avgB = sumB / pixels;
  const grey = (avgR + avgG + avgB) / 3;

  const gainR = grey / (avgR || 1);
  const gainG = grey / (avgG || 1);
  const gainB = grey / (avgB || 1);

  // Contrast around mid-grey, biased so paper clears to white.
  const contrast = 1.35;
  const curve = (v: number) => {
    const balanced = Math.min(255, v);
    const scaled = (balanced - 128) * contrast + 138;
    return scaled < 0 ? 0 : scaled > 255 ? 255 : scaled;
  };

  for (let i = 0; i < data.length; i += 4) {
    data[i] = curve(data[i] * gainR);
    data[i + 1] = curve(data[i + 1] * gainG);
    data[i + 2] = curve(data[i + 2] * gainB);
  }
}
