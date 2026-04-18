/** CoreBlow — NPM Integrity */
import { createHash } from "node:crypto";
import fs from "node:fs";
export function computeFileIntegrity(filePath: string, algorithm = "sha512"): string { const content = fs.readFileSync(filePath); const hash = createHash(algorithm).update(content).digest("base64"); return algorithm + "-" + hash; }
