/** CoreBlow — Restart Logic */
import { spawn } from "node:child_process";
export interface RestartOptions { gracefulTimeoutMs?: number; args?: string[]; }
export function scheduleRestart(opts?: RestartOptions): void { const delay = opts?.gracefulTimeoutMs ?? 1000; setTimeout(() => { const args = opts?.args ?? process.argv.slice(1); const child = spawn(process.execPath, args, { detached: true, stdio: "ignore" }); child.unref(); process.exit(0); }, delay); }
