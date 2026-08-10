import "server-only";
import { NextResponse } from "next/server";

import { PdfError } from "@/lib/pdf/document";

/** Stable machine codes; the client maps these to translated messages. */
export type ApiErrorCode =
  | "bad-request"
  | "not-found"
  | "rate-limited"
  | "too-large"
  | "unsupported-type"
  | "encrypted"
  | "wrong-password"
  | "corrupt"
  | "no-files"
  | "processing-failed"
  | "not-implemented";

export function apiError(code: ApiErrorCode, message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

export function apiOk<T extends Record<string, unknown>>(data: T) {
  return NextResponse.json(data);
}

/** Maps a thrown processor error onto an API response. */
export function errorFromException(err: unknown) {
  if (err instanceof PdfError) {
    switch (err.code) {
      case "encrypted":
        return apiError("encrypted", err.message, 400);
      case "wrong-password":
        return apiError("wrong-password", err.message, 400);
      case "corrupt":
      case "empty":
        return apiError("corrupt", err.message, 400);
      case "unsupported":
        return apiError("unsupported-type", err.message, 415);
      case "too-large":
        return apiError("too-large", err.message, 413);
      default:
        return apiError("processing-failed", err.message, 500);
    }
  }

  const message = err instanceof Error ? err.message : "Unexpected error";
  console.error("[xtools] processing failed:", err);
  return apiError("processing-failed", message, 500);
}
