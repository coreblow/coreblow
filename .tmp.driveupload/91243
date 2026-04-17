/**
 * agents/session-dirs.ts
 * Session directory management.
 */
import fs from 'node:fs';
import path from 'node:path';

export function resolveSessionDir(baseDir: string, sessionId: string): string {
    return path.join(baseDir, '.coreblow', 'sessions', sessionId);
}
export function ensureSessionDir(baseDir: string, sessionId: string): string {
    const dir = resolveSessionDir(baseDir, sessionId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
export function resolveTranscriptPath(baseDir: string, sessionId: string): string {
    return path.join(resolveSessionDir(baseDir, sessionId), 'transcript.jsonl');
}
export function resolveSessionMetaPath(baseDir: string, sessionId: string): string {
    return path.join(resolveSessionDir(baseDir, sessionId), 'session.json');
}
export function listSessions(baseDir: string): string[] {
    const dir = path.join(baseDir, '.coreblow', 'sessions');
    try { return fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isDirectory()); } catch { return []; }
}
export function deleteSession(baseDir: string, sessionId: string): boolean {
    const dir = resolveSessionDir(baseDir, sessionId);
    try { fs.rmSync(dir, { recursive: true, force: true }); return true; } catch { return false; }
}
