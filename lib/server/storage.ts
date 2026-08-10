import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const STORAGE_ROOT = path.join(process.cwd(), "storage", "tasks");

/** Tasks older than this are swept from disk. */
export const RETENTION_MS = 2 * 60 * 60 * 1000;

export interface StoredFile {
  /** Name as uploaded, already sanitised. */
  name: string;
  /** Absolute path on disk. */
  path: string;
  size: number;
}

export interface TaskManifest {
  id: string;
  tool: string;
  createdAt: number;
  inputs: { name: string; size: number }[];
  outputs?: { name: string; size: number }[];
  /** Free-form numbers the result screen shows, e.g. compression savings. */
  stats?: Record<string, number | string>;
}

/**
 * Strips directory components and anything that could escape the task folder.
 * Upload names come straight from the client, so this is a security boundary.
 */
export function safeFileName(raw: string): string {
  const base = path.basename(raw.replace(/\\/g, "/"));
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"|?*]/g, "_")
    .replace(/^\.+/, "")
    .trim();
  return cleaned.slice(0, 180) || "file";
}

export function extensionOf(name: string): string {
  const ext = path.extname(name).toLowerCase();
  return ext;
}

export function stripExtension(name: string): string {
  const ext = path.extname(name);
  return ext ? name.slice(0, -ext.length) : name;
}

/** Rejects any id that isn't one we generated, before it reaches the filesystem. */
export function isValidTaskId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export function taskDir(id: string): string {
  if (!isValidTaskId(id)) throw new Error("Invalid task id");
  return path.join(STORAGE_ROOT, id);
}

export const inputDir = (id: string) => path.join(taskDir(id), "in");
export const outputDir = (id: string) => path.join(taskDir(id), "out");
const manifestPath = (id: string) => path.join(taskDir(id), "task.json");

export async function createTask(tool: string): Promise<string> {
  const id = randomUUID();
  await mkdir(inputDir(id), { recursive: true });
  await mkdir(outputDir(id), { recursive: true });
  const manifest: TaskManifest = { id, tool, createdAt: Date.now(), inputs: [] };
  await writeManifest(manifest);
  return id;
}

export async function readManifest(id: string): Promise<TaskManifest | null> {
  try {
    const raw = await readFile(manifestPath(id), "utf8");
    return JSON.parse(raw) as TaskManifest;
  } catch {
    return null;
  }
}

export async function writeManifest(manifest: TaskManifest): Promise<void> {
  await writeFile(manifestPath(manifest.id), JSON.stringify(manifest, null, 2), "utf8");
}

/** Writes an upload into the task's input folder, de-duplicating repeated names. */
export async function saveInput(id: string, name: string, data: Buffer): Promise<StoredFile> {
  const dir = inputDir(id);
  await mkdir(dir, { recursive: true });

  let fileName = safeFileName(name);
  let target = path.join(dir, fileName);
  let counter = 1;
  while (await exists(target)) {
    const ext = path.extname(fileName);
    const base = stripExtension(fileName);
    target = path.join(dir, `${base} (${counter})${ext}`);
    counter += 1;
  }
  fileName = path.basename(target);

  await writeFile(target, data);
  return { name: fileName, path: target, size: data.byteLength };
}

export async function listInputs(id: string): Promise<StoredFile[]> {
  return listDir(inputDir(id));
}

export async function listOutputs(id: string): Promise<StoredFile[]> {
  return listDir(outputDir(id));
}

async function listDir(dir: string): Promise<StoredFile[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const files: StoredFile[] = [];
  for (const name of names.sort((a, b) => a.localeCompare(b, "en", { numeric: true }))) {
    const full = path.join(dir, name);
    const info = await stat(full);
    if (info.isFile()) files.push({ name, path: full, size: info.size });
  }
  return files;
}

export async function writeOutput(id: string, name: string, data: Buffer): Promise<StoredFile> {
  const dir = outputDir(id);
  await mkdir(dir, { recursive: true });
  const fileName = safeFileName(name);
  const target = path.join(dir, fileName);
  await writeFile(target, data);
  return { name: fileName, path: target, size: data.byteLength };
}

/** Guards against a crafted name reading files outside the task's output folder. */
export function resolveOutputPath(id: string, name: string): string | null {
  const dir = outputDir(id);
  const resolved = path.resolve(dir, safeFileName(name));
  return resolved.startsWith(path.resolve(dir) + path.sep) ? resolved : null;
}

export async function deleteTask(id: string): Promise<void> {
  await rm(taskDir(id), { recursive: true, force: true });
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/** Removes task folders past the retention window. Returns how many were deleted. */
export async function sweepExpiredTasks(now = Date.now()): Promise<number> {
  let entries: string[];
  try {
    entries = await readdir(STORAGE_ROOT);
  } catch {
    return 0;
  }

  let removed = 0;
  for (const entry of entries) {
    if (!isValidTaskId(entry)) continue;
    const dir = path.join(STORAGE_ROOT, entry);
    try {
      const info = await stat(dir);
      if (now - info.mtimeMs > RETENTION_MS) {
        await rm(dir, { recursive: true, force: true });
        removed += 1;
      }
    } catch {
      // Another sweep already removed it.
    }
  }
  return removed;
}

export function hashBuffer(data: Buffer): string {
  return createHash("sha1").update(data).digest("hex").slice(0, 12);
}
