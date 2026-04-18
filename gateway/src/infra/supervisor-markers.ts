/** CoreBlow — Supervisor Markers */
import fs from "node:fs";
import path from "node:path";
export function writeSupervisorMarker(stateDir: string, marker: string): void { fs.writeFileSync(path.join(stateDir, ".supervisor-" + marker), String(Date.now())); }
export function readSupervisorMarker(stateDir: string, marker: string): number | null { try { return parseInt(fs.readFileSync(path.join(stateDir, ".supervisor-" + marker), "utf8").trim(), 10) || null; } catch { return null; } }
