/** CoreBlow — SSH Config Parser */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
export interface SshHostConfig { host: string; hostname?: string; user?: string; port?: number; identityFile?: string; }
export function readSshConfig(): SshHostConfig[] { try { const raw = fs.readFileSync(path.join(os.homedir(), ".ssh", "config"), "utf8"); const hosts: SshHostConfig[] = []; let current: SshHostConfig | null = null;
for (const line of raw.split("\n")) { const trimmed = line.trim(); if (trimmed.startsWith("Host ") && !trimmed.includes("*")) { if (current) hosts.push(current); current = { host: trimmed.slice(5).trim() }; } else if (current) { if (trimmed.startsWith("HostName")) current.hostname = trimmed.split(/\s+/)[1]; if (trimmed.startsWith("User")) current.user = trimmed.split(/\s+/)[1]; if (trimmed.startsWith("Port")) current.port = parseInt(trimmed.split(/\s+/)[1], 10); } }
if (current) hosts.push(current); return hosts; } catch { return []; } }
