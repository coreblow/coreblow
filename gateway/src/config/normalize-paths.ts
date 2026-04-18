/** CoreBlow — Normalize Config Paths */
import path from "node:path";
export function normalizeConfigPath(p: string, homeDir?: string): string { if (p.startsWith("~/") && homeDir) return path.join(homeDir, p.slice(2)); return path.resolve(p); }
