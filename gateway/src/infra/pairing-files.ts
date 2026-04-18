/** CoreBlow — Pairing Files */
import fs from "node:fs";
import path from "node:path";
export function readPairingFile(stateDir: string): Record<string, unknown> | null { try { return JSON.parse(fs.readFileSync(path.join(stateDir, "pairing.json"), "utf8")); } catch { return null; } }
export function writePairingFile(stateDir: string, data: Record<string, unknown>): void { fs.writeFileSync(path.join(stateDir, "pairing.json"), JSON.stringify(data, null, 2)); }
