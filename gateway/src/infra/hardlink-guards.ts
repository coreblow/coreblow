/** CoreBlow — Hardlink Guards */
import fs from "node:fs";
export function isHardlink(filePath: string): boolean { try { const stat = fs.lstatSync(filePath); return stat.nlink > 1; } catch { return false; } }
export function assertNotHardlink(filePath: string): void { if (isHardlink(filePath)) throw new Error("Security: refusing to operate on hardlinked file: " + filePath); }
