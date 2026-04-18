/** CoreBlow — Tailscale Integration */
import { execFileSync } from "node:child_process";
export interface TailscaleStatus { online: boolean; hostname?: string; tailIp?: string; }
export function getTailscaleStatus(): TailscaleStatus { try { const raw = execFileSync("tailscale", ["status", "--json"], { encoding: "utf8", timeout: 5000 }); const data = JSON.parse(raw); return { online: true, hostname: data.Self?.HostName, tailIp: data.Self?.TailscaleIPs?.[0] }; } catch { return { online: false }; } }
