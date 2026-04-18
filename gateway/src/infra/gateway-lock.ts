/** CoreBlow — Gateway Lock */
import fs from "node:fs";
import path from "node:path";
export function acquireGatewayLock(stateDir: string): boolean {
  const lockPath = path.join(stateDir, "gateway.lock");
  try { fs.writeFileSync(lockPath, String(process.pid), { flag: "wx" }); return true; } catch { return false; }
}
export function releaseGatewayLock(stateDir: string): void {
  const lockPath = path.join(stateDir, "gateway.lock");
  try { fs.unlinkSync(lockPath); } catch {}
}
export function readGatewayLockPid(stateDir: string): number | null {
  try { return parseInt(fs.readFileSync(path.join(stateDir, "gateway.lock"), "utf8").trim(), 10) || null; } catch { return null; }
}
