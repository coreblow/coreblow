/**
 * CoreBlow — Backup Create
 */
import fs from 'node:fs';
import path from 'node:path';
import { collectArchiveEntries, gzipFile } from './archive.js';
import { resolveArchivePath } from './archive-path.js';

export interface BackupOptions {
  sourceDir: string;
  outputDir: string;
  name?: string;
  excludePatterns?: string[];
}

export interface BackupResult {
  archivePath: string;
  filesCount: number;
  totalBytes: number;
}

export async function createBackup(opts: BackupOptions): Promise<BackupResult> {
  const name = opts.name ?? 'coreblow-backup';
  const archivePath = resolveArchivePath(opts.outputDir, name);
  fs.mkdirSync(opts.outputDir, { recursive: true });
  const entries = collectArchiveEntries(opts.sourceDir, opts.excludePatterns ?? ['node_modules', '.git']);
  const filesCount = entries.filter((e) => !e.isDirectory).length;
  const totalBytes = entries.reduce((sum, e) => sum + e.size, 0);
  const manifestPath = path.join(opts.outputDir, `${name}-manifest.json`);
  fs.writeFileSync(manifestPath, JSON.stringify({ entries, createdAt: new Date().toISOString() }, null, 2));
  await gzipFile(manifestPath, archivePath);
  try { fs.unlinkSync(manifestPath); } catch {}
  return { archivePath, filesCount, totalBytes };
}
