/**
 * cron/cron-lock.ts
 */
export class CronLock { private locked = new Set<string>(); acquire(id: string) { if (this.locked.has(id)) return false; this.locked.add(id); return true; } release(id: string) { this.locked.delete(id); } }
