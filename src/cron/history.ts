/**
 * cron/history.ts
 */
export class CronHistory { private entries: Array<{jobId: string; ranAt: number; durationMs: number; success: boolean; error?: string}> = []; record(jobId: string, durationMs: number, success: boolean, error?: string) { this.entries.push({jobId, ranAt: Date.now(), durationMs, success, error}); if (this.entries.length > 1000) this.entries.shift(); } getByJob(id: string) { return this.entries.filter(e => e.jobId === id); } getFailures() { return this.entries.filter(e => !e.success); } }
