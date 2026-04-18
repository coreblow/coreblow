/** CoreBlow — Update Runner */
import { checkForUpdates, type UpdateInfo } from "./update-check.js";
import { resolveUpdateChannel } from "./update-channels.js";
export async function runUpdateCheck(currentVersion: string, env: NodeJS.ProcessEnv = process.env): Promise<UpdateInfo> { const channel = resolveUpdateChannel(env); return checkForUpdates(currentVersion, channel); }
