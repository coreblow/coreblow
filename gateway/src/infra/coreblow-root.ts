/** CoreBlow — CoreBlow Root Path */
import path from "node:path";
import { fileURLToPath } from "node:url";
let cachedRoot: string | null = null;
export function getCoreBlowRoot(): string { if (cachedRoot) return cachedRoot; try { cachedRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."); } catch { cachedRoot = process.cwd(); } return cachedRoot; }
