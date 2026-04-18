/** CoreBlow — Secret File IO */
import fs from "node:fs";
export function readSecretFile(filePath: string): string | null { try { const content = fs.readFileSync(filePath, "utf8").trim(); return content || null; } catch { return null; } }
export function writeSecretFile(filePath: string, secret: string): void { fs.writeFileSync(filePath, secret, { mode: 0o600 }); }
