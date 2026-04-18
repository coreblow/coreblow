/**
 * CoreBlow — Archive Path Resolution
 */
import path from 'node:path';

export function resolveArchivePath(baseDir: string, name: string, ext = '.tar.gz'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return path.join(baseDir, `${name}-${timestamp}${ext}`);
}

export function parseArchiveFilename(filename: string): { name: string; timestamp: string } | null {
  const match = /^(.+?)-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})\.tar\.gz$/.exec(filename);
  if (!match) return null;
  return { name: match[1], timestamp: match[2].replace(/-/g, ':').replace('T', 'T') };
}
