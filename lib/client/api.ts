import type { Dictionary } from "@/lib/i18n";

export interface ApiFile {
  name: string;
  size: number;
  /** Present for PDFs uploaded to a tool that mounts a visual editor. */
  pages?: number;
}

export interface ProcessResponse {
  outputs: ApiFile[];
  stats: Record<string, number | string>;
  output: string;
  zip: boolean;
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Turns an error code into a message in the active language. */
export function messageFor(t: Dictionary, err: unknown): string {
  const table = t.errors as Record<string, string | undefined>;
  if (err instanceof ApiError) return table[err.code] ?? err.message ?? table.unknown!;
  if (err instanceof TypeError) return table.network!;
  return table.unknown!;
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string } };
    const error = body.error;
    return new ApiError(error?.code ?? "unknown", error?.message ?? res.statusText, error);
  } catch {
    return new ApiError("unknown", res.statusText);
  }
}

export async function createTask(tool: string): Promise<string> {
  const res = await fetch("/api/task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool }),
  });
  if (!res.ok) throw await parseError(res);
  const body = (await res.json()) as { taskId: string };
  return body.taskId;
}

/**
 * Uploads via XHR rather than fetch because only XHR reports upload progress,
 * which the workspace needs for its progress bar.
 */
export function uploadFiles(
  taskId: string,
  files: File[],
  onProgress?: (fraction: number) => void,
): Promise<ApiFile[]> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const file of files) form.append("files", file, file.name);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/task/${taskId}/upload`);
    xhr.responseType = "json";

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(event.loaded / event.total);
    };

    xhr.onload = () => {
      const body = xhr.response as
        | { files?: ApiFile[]; error?: { code?: string; message?: string } }
        | null;

      if (xhr.status >= 200 && xhr.status < 300 && body?.files) {
        onProgress?.(1);
        resolve(body.files);
      } else {
        reject(new ApiError(body?.error?.code ?? "unknown", body?.error?.message ?? "Upload failed", body?.error));
      }
    };

    xhr.onerror = () => reject(new ApiError("network", "Network error"));
    xhr.ontimeout = () => reject(new ApiError("network", "Upload timed out"));

    xhr.send(form);
  });
}

export async function processTask(
  taskId: string,
  files: string[],
  options: Record<string, unknown>,
): Promise<ProcessResponse> {
  const res = await fetch(`/api/task/${taskId}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files, options }),
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as ProcessResponse;
}

export function downloadUrl(taskId: string, file?: string): string {
  const base = `/api/task/${taskId}/download`;
  return file ? `${base}?file=${encodeURIComponent(file)}` : base;
}

export function previewUrl(taskId: string, file: string, page: number, width = 240): string {
  const params = new URLSearchParams({ file, page: String(page), w: String(width) });
  return `/api/task/${taskId}/preview?${params.toString()}`;
}
