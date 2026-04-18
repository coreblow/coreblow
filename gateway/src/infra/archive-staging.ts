/**
 * CoreBlow — Archive Staging
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface StagingArea { dir: string; cleanup: () => void; }

export function createStagingArea(prefix = 'coreblow-staging-'): StagingArea {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return { dir, cleanup: () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} } };
}

export function stageFile(stagingDir: string, relativePath: string, content: string | Buffer): string {
  const targetPath = path.join(stagingDir, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content);
  return targetPath;
}
