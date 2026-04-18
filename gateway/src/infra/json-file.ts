/** CoreBlow — JSON File IO */
import fs from "node:fs";
export function readJsonFile<T = unknown>(filePath: string): T | null { try { return JSON.parse(fs.readFileSync(filePath, "utf8")) as T; } catch { return null; } }
export function writeJsonFile(filePath: string, data: unknown, pretty = true): void { fs.writeFileSync(filePath, JSON.stringify(data, null, pretty ? 2 : 0) + "\n"); }
