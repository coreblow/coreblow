/**
 * cron/next-run.ts
 */
export function shouldRun(lastRun: number, intervalMs: number) { return Date.now() - lastRun >= intervalMs; }
