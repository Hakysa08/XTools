import "server-only";
import { createWriteStream } from "node:fs";
import { ZipArchive } from "archiver";

export interface ZipEntry {
  name: string;
  data: Buffer;
}

/** Streams entries into a ZIP at `target`, resolving with its size in bytes. */
export function writeZip(target: string, entries: ZipEntry[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(target);
    // archiver 8 exposes archive classes rather than the old callable factory.
    const archive = new ZipArchive({ zlib: { level: 6 } });

    output.on("close", () => resolve(archive.pointer()));
    output.on("error", reject);
    archive.on("error", reject);
    // Missing-file warnings are fatal here since every entry is in-memory.
    archive.on("warning", reject);

    archive.pipe(output);
    for (const entry of entries) {
      archive.append(entry.data, { name: entry.name });
    }
    void archive.finalize();
  });
}

/** Zero-pads so 10 files sort as 01..10 rather than 1, 10, 2. */
export function numbered(index: number, total: number): string {
  return String(index).padStart(String(total).length, "0");
}
