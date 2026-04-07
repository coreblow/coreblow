/**
 * commands/cooldown.ts
 */
export class CommandCooldown { private cooldowns = new Map<string, number>(); private defaultMs: number; constructor(defaultMs = 1000) { this.defaultMs = defaultMs; } check(userId: string, command: string): boolean { const key = `${userId}:${command}`; const last = this.cooldowns.get(key) || 0; if (Date.now() - last < this.defaultMs) return false; this.cooldowns.set(key, Date.now()); return true; } remaining(userId: string, command: string): number { const key = `${userId}:${command}`; const last = this.cooldowns.get(key) || 0; return Math.max(0, this.defaultMs - (Date.now() - last)); } }
