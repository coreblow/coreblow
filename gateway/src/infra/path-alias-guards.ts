/** CoreBlow — Path Alias Guards */
import path from "node:path";
export function isPathAlias(p: string): boolean { return p.startsWith("~") || p.includes("$") || p.includes("%"); }
export function resolvePathAlias(p: string): string { if (p.startsWith("~/")) return path.join(process.env.HOME || "", p.slice(2)); return p; }
