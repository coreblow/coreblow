import "./fs-safe-defaults.js";
import type { Stats } from "node:fs";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

export type RegularFileStatResult =
  | { missing: true }
  | { missing: false; stat: Stats };

type RegularFileAppendFlagConstants = Pick<
  typeof fsSync.constants,
  "O_APPEND" | "O_CREAT" | "O_WRONLY"
> &
  Partial<Pick<typeof fsSync.constants, "O_NOFOLLOW">>;

export type AppendRegularFileOptions = {
  filePath: string;
  content: string | Uint8Array;
  encoding?: BufferEncoding;
  maxFileBytes?: number;
  mode?: number;
  rejectSymlinkParents?: boolean;
};

export function resolveRegularFileAppendFlags(
  constants: RegularFileAppendFlagConstants = fsSync.constants,
): number {
  const noFollow = constants.O_NOFOLLOW;
  return (
    constants.O_CREAT |
    constants.O_APPEND |
    constants.O_WRONLY |
    (typeof noFollow === "number" ? noFollow : 0)
  );
}

export async function statRegularFile(filePath: string): Promise<RegularFileStatResult> {
  try {
    const stat = await fs.stat(filePath);
    return { missing: false, stat };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { missing: true };
    }
    throw err;
  }
}

export function statRegularFileSync(filePath: string): RegularFileStatResult {
  try {
    const stat = fsSync.statSync(filePath);
    return { missing: false, stat };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { missing: true };
    }
    throw err;
  }
}

export async function readRegularFile(params: {
  filePath: string;
  maxBytes?: number;
}): Promise<{ buffer: Buffer; stat: Stats }> {
  const stat = await fs.stat(params.filePath);
  if (params.maxBytes !== undefined && stat.size > params.maxBytes) {
    throw new Error(`File ${params.filePath} exceeds maximum allowed size of ${params.maxBytes} bytes`);
  }
  const buffer = await fs.readFile(params.filePath);
  return { buffer, stat };
}

export function readRegularFileSync(params: {
  filePath: string;
  maxBytes?: number;
}): { buffer: Buffer; stat: Stats } {
  const stat = fsSync.statSync(params.filePath);
  if (params.maxBytes !== undefined && stat.size > params.maxBytes) {
    throw new Error(`File ${params.filePath} exceeds maximum allowed size of ${params.maxBytes} bytes`);
  }
  const buffer = fsSync.readFileSync(params.filePath);
  return { buffer, stat };
}

export async function appendRegularFile(options: AppendRegularFileOptions): Promise<void> {
  await fs.mkdir(path.dirname(options.filePath), { recursive: true });
  if (options.maxFileBytes !== undefined) {
    const existing = await statRegularFile(options.filePath);
    if (!existing.missing && existing.stat.size > options.maxFileBytes) {
      throw new Error(
        `File ${options.filePath} already exceeds maximum append size of ${options.maxFileBytes} bytes`,
      );
    }
  }
  await fs.appendFile(options.filePath, options.content, {
    encoding: options.encoding ?? "utf8",
    mode: options.mode ?? 0o644,
  });
}

export function appendRegularFileSync(options: AppendRegularFileOptions): void {
  fsSync.mkdirSync(path.dirname(options.filePath), { recursive: true });
  if (options.maxFileBytes !== undefined) {
    const existing = statRegularFileSync(options.filePath);
    if (!existing.missing && existing.stat.size > options.maxFileBytes) {
      throw new Error(
        `File ${options.filePath} already exceeds maximum append size of ${options.maxFileBytes} bytes`,
      );
    }
  }
  fsSync.appendFileSync(options.filePath, options.content, {
    encoding: options.encoding ?? "utf8",
    mode: options.mode ?? 0o644,
  });
}
