/**
 * infra/scheduler/task-scheduler.ts
 */
export class TaskScheduler { private tasks = new Map<string, {fn: () => Promise<void>; interval: number; timer?: NodeJS.Timeout; running: boolean}>(); add(id: string, fn: () => Promise<void>, intervalMs: number) { this.tasks.set(id, {fn, interval: intervalMs, running: false}); } start(id: string) { const t = this.tasks.get(id); if (!t || t.running) return; t.running = true; t.timer = setInterval(async () => { try { await t.fn(); } catch { /* intentionally ignored */ } }, t.interval); } stop(id: string) { const t = this.tasks.get(id); if (t?.timer) { clearInterval(t.timer); t.running = false; } } }
