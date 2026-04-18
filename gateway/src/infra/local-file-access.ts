/** CoreBlow — Local File Access */
import fs from "node:fs";
export function readLocalFile(filePath: string): string | null { try { return fs.readFileSync(filePath, "utf8"); } catch { return null; } }
export function localFileExists(filePath: string): boolean { try { return fs.existsSync(filePath); } catch { return false; } }
