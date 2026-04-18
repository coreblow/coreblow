/**
 * CoreBlow — Archive Utilities
 *
 * Create and extract tar.gz archives for backup, plugin packaging,
 * and state migration. Uses Node.js built-in zlib.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createGzip, createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';

export interface ArchiveCreateOptions {
  sourcePath: string;
  outputPath: string;
  excludePatterns?: string[];
}

export interface ArchiveExtractOptions {
  archivePath: string;
  outputDir: string;
}

export interface ArchiveEntry {
  relativePath: string;
  size: number;
  isDirectory: boolean;
}

/**
 * Collect files from a directory tree for archiving.
 */
export function collectArchiveEntries(
  rootDir: string,
  excludePatterns: string[] = [],
): ArchiveEntry[] {
  const entries: ArchiveEntry[] = [];
  const walk = (dir: string, prefix: string) => {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      const relativePath = path.join(prefix, item.name);
      if (excludePatterns.some((p) => relativePath.includes(p))) continue;
      if (item.isDirectory()) {
        entries.push({ relativePath, size: 0, isDirectory: true });
        walk(fullPath, relativePath);
      } else if (item.isFile()) {
        const stat = fs.statSync(fullPath);
        entries.push({ relativePath, size: stat.size, isDirectory: false });
      }
    }
  };
  walk(rootDir, '');
  return entries;
}

/**
 * Compress a single file with gzip.
 */
export async function gzipFile(inputPath: string, outputPath: string): Promise<void> {
  const input = fs.createReadStream(inputPath);
  const output = fs.createWriteStream(outputPath);
  const gzip = createGzip({ level: 6 });
  await pipeline(input, gzip, output);
}

/**
 * Decompress a gzipped file.
 */
export async function gunzipFile(inputPath: string, outputPath: string): Promise<void> {
  const input = fs.createReadStream(inputPath);
  const output = fs.createWriteStream(outputPath);
  const gunzip = createGunzip();
  await pipeline(input, gunzip, output);
}

/**
 * Verify an archive file exists and is readable.
 */
export function verifyArchive(archivePath: string): { valid: boolean; error?: string } {
  try {
    const stat = fs.statSync(archivePath);
    if (!stat.isFile()) return { valid: false, error: 'Not a file' };
    if (stat.size === 0) return { valid: false, error: 'Empty archive' };
    return { valid: true };
  } catch (err) {
    return { valid: false, error: String(err) };
  }
}
