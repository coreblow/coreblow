/** CoreBlow — Ports Inspect */
import { execFileSync } from "node:child_process";
export interface PortInfo { port: number; pid?: number; process?: string; }
export function inspectPorts(ports: number[]): PortInfo[] { return ports.map((port) => { try { const out = execFileSync("lsof", ["-i", ":" + port, "-t"], { encoding: "utf8", timeout: 5000 }).trim(); return { port, pid: parseInt(out, 10) || undefined }; } catch { return { port }; } }); }
