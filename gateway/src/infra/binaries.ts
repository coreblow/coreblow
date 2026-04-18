/**
 * CoreBlow — Binaries Resolution
 */
import { execFileSync } from 'node:child_process';

export function resolveBinaryPath(name: string): string | null {
  try {
    const result = execFileSync('which', [name], { encoding: 'utf8', timeout: 5000 }).trim();
    return result || null;
  } catch { return null; }
}
