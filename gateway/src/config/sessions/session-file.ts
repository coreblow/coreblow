/** CoreBlow — Session File */
import fs from "node:fs";
import path from "node:path";
export interface SessionFile { sessionId: string; filePath: string; createdAt: number; }
export function resolveSessionFilePath(sessionsDir: string, sessionId: string): string { return path.join(sessionsDir, sessionId + ".json"); }
export function sessionFileExists(sessionsDir: string, sessionId: string): boolean { return fs.existsSync(resolveSessionFilePath(sessionsDir, sessionId)); }
