/** CoreBlow — Temp Directory */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
export function createTmpCoreBlowDir(prefix = "coreblow-"): string { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }
export function cleanTmpCoreBlowDirs(): number { const tmpDir = os.tmpdir(); let cleaned = 0; try { for (const entry of fs.readdirSync(tmpDir)) { if (entry.startsWith("coreblow-")) { try { fs.rmSync(path.join(tmpDir, entry), { recursive: true, force: true }); cleaned++; } catch {} } } } catch {} return cleaned; }
