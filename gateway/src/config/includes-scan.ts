/** CoreBlow — Config Includes Scan */
import fs from "node:fs";
import path from "node:path";
export function scanForIncludes(configDir: string, pattern = "*.json"): string[] { try { return fs.readdirSync(configDir).filter((f) => f.endsWith(".json") && f !== "coreblow.json").map((f) => path.join(configDir, f)); } catch { return []; } }
