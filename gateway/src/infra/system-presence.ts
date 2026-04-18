/** CoreBlow — System Presence */
export interface PresenceInfo { pid: number; startedAt: number; version: string; hostname: string; port?: number; }
import os from "node:os";
let presence: PresenceInfo | null = null;
export function registerPresence(version: string, port?: number): PresenceInfo { presence = { pid: process.pid, startedAt: Date.now(), version, hostname: os.hostname(), port }; return presence; }
export function getPresence(): PresenceInfo | null { return presence; }
export function clearPresence(): void { presence = null; }
