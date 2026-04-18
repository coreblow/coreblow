/** CoreBlow — File Lock */
import fs from 'node:fs';
import path from 'node:path';

export async function lockFile(filePath: string, timeoutMs = 10000): Promise<() => void> {
  const lockPath = filePath + '.lock';
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      fs.mkdirSync(lockPath);
      return () => {
        try { fs.rmdirSync(lockPath); } catch { /* already removed */ }
      };
    } catch {
      await new Promise((r) => setTimeout(r, 50));
    }
  }
  throw new Error(`Failed to acquire lock on ${filePath} within ${timeoutMs}ms`);
}

export async function unlockFile(filePath: string): Promise<void> {
  const lockPath = filePath + '.lock';
  try { fs.rmdirSync(lockPath); } catch { /* already removed */ }
}
