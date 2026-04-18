/** CoreBlow — Resolve System Binary */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
export function resolveSystemBin(name: string): string | null { try { const p = execFileSync("which", [name], { encoding: "utf8", timeout: 5000 }).trim(); return p && fs.existsSync(p) ? p : null; } catch { return null; } }
export function requireSystemBin(name: string): string { const p = resolveSystemBin(name); if (!p) throw new Error("Required binary not found: " + name); return p; }
