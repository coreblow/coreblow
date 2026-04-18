/** CoreBlow — Process Respawn */
import { spawn } from "node:child_process";
export interface RespawnOptions { command: string; args: string[]; maxRestarts: number; delayMs: number; }
export function respawnProcess(opts: RespawnOptions): void { let restarts = 0; const doSpawn = () => { const child = spawn(opts.command, opts.args, { stdio: "inherit", detached: false }); child.on("exit", (code) => { if (code !== 0 && restarts < opts.maxRestarts) { restarts++; setTimeout(doSpawn, opts.delayMs); } }); }; doSpawn(); }
