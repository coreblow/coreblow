/** CoreBlow — Session Store Read */
import fs from "node:fs";
import { resolveSessionFilePath } from "./session-file.js";
export function readSessionData(sessionsDir: string, sessionId: string): Record<string, unknown> | null { try { return JSON.parse(fs.readFileSync(resolveSessionFilePath(sessionsDir, sessionId), "utf8")); } catch { return null; } }
