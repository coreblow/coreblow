/** CoreBlow — Session Reset */
import fs from "node:fs";
import { resolveSessionDir } from "./paths.js";
export function resetSession(stateDir: string, sessionId: string): boolean { const dir = resolveSessionDir(stateDir, sessionId); try { fs.rmSync(dir, { recursive: true, force: true }); return true; } catch { return false; } }
