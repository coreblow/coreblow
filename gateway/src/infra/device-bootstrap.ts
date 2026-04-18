/** CoreBlow — Device Bootstrap */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
export interface BootstrapResult { deviceId: string; homeDir: string; stateDir: string; firstRun: boolean; }
export function bootstrapDevice(env: NodeJS.ProcessEnv = process.env): BootstrapResult {
  const home = os.homedir();
  const stateDir = env.COREBLOW_STATE_DIR?.trim() || path.join(home, ".coreblow");
  const firstRun = !fs.existsSync(stateDir);
  if (firstRun) fs.mkdirSync(stateDir, { recursive: true });
  const idFile = path.join(stateDir, "device-id");
  let deviceId: string;
  try { deviceId = fs.readFileSync(idFile, "utf8").trim(); } catch { deviceId = crypto.randomUUID(); fs.writeFileSync(idFile, deviceId); }
  return { deviceId, homeDir: home, stateDir, firstRun };
}
