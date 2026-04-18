/** CoreBlow — Config Includes */
import { readJsonFile } from "../infra/json-file.js";
export interface ConfigInclude { path: string; optional?: boolean; }
export function resolveIncludes(includes: ConfigInclude[]): Record<string, unknown>[] { const results: Record<string, unknown>[] = []; for (const inc of includes) { const data = readJsonFile(inc.path); if (data && typeof data === "object") results.push(data as Record<string, unknown>); else if (!inc.optional) throw new Error("Required config include not found: " + inc.path); } return results; }
