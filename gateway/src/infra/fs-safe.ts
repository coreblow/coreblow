/** Safe filesystem utilities */
import fs from 'node:fs';
import path from 'node:path';
export function readFileSafe(p: string): string | null { try { return fs.readFileSync(p, 'utf-8'); } catch { return null; } }
export function writeFileSafe(p: string, data: string): boolean { try { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); return true; } catch { return false; } }
export function existsSafe(p: string): boolean { try { return fs.existsSync(p); } catch { return false; } }
export function mkdirSafe(p: string): boolean { try { fs.mkdirSync(p, { recursive: true }); return true; } catch { return false; } }


export class SafeOpenError extends Error { constructor(msg: string) { super(msg); this.name = 'SafeOpenError'; } }
export interface SafeOpenResult { content: string; path: string; stats: { size: number; mtime: Date }; }
export async function openFileWithinRoot(rootDir: string, relPath: string): Promise<SafeOpenResult> {
    const resolved = path.resolve(rootDir, relPath);
    if (!resolved.startsWith(path.resolve(rootDir))) throw new SafeOpenError('Path traversal detected');
    const content = fs.readFileSync(resolved, 'utf-8');
    const stats = fs.statSync(resolved);
    return { content, path: resolved, stats: { size: stats.size, mtime: stats.mtime } };
}
