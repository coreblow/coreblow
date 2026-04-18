/** CoreBlow — Safe Open Sync */
import fs from "node:fs";
import path from "node:path";
export function safeOpenSync(filePath: string, flags: string): number { const resolved = path.resolve(filePath); const stat = fs.lstatSync(resolved, { throwIfNoEntry: false }); if (stat?.isSymbolicLink()) throw new Error("Refusing to open symlink: " + resolved); return fs.openSync(resolved, flags); }
