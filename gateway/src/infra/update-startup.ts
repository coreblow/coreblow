/** CoreBlow — Update Startup Check */
import { runUpdateCheck } from "./update-runner.js";
export async function checkUpdateOnStartup(version: string): Promise<void> { const info = await runUpdateCheck(version); if (info.updateAvailable) console.log("[coreblow] Update available: " + info.latestVersion + " (current: " + info.currentVersion + ")"); }
