/** CoreBlow — Session Paths */
import path from "node:path";
export function resolveSessionsDir(stateDir: string): string { return path.join(stateDir, "sessions"); }
export function resolveSessionDir(stateDir: string, sessionId: string): string { return path.join(resolveSessionsDir(stateDir), sessionId); }
export function resolveSessionTranscriptPath(stateDir: string, sessionId: string): string { return path.join(resolveSessionDir(stateDir, sessionId), "transcript.jsonl"); }
