/** CoreBlow — Ports LSOF */
import { execFileSync } from "node:child_process";
export function lsofPort(port: number): number | null { try { const out = execFileSync("lsof", ["-ti", ":" + port], { encoding: "utf8", timeout: 5000 }).trim(); return parseInt(out, 10) || null; } catch { return null; } }
