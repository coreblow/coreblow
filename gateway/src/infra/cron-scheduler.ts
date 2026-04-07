/**
 * CoreBlow — Cron Scheduler
 *
 * Manages scheduled tasks with cron-like expressions.
 * Supports recurring jobs, one-shot timers, job history,
 * and pause/resume functionality.
 */

/** Scheduled job */
export interface ScheduledJob {
    id: string;
    name: string;
    intervalMs: number;
    handler: () => Promise<void> | void;
    status: 'active' | 'paused' | 'stopped';
    lastRun?: number;
    nextRun: number;
    runCount: number;
    maxRuns?: number;
    errors: number;
}

/** Job result */
export interface JobResult {
    jobId: string;
    success: boolean;
    durationMs: number;
    error?: string;
    timestamp: number;
}

/**
 * CoreBlow Cron Scheduler
 */
export class CronScheduler {
    private jobs = new Map<string, ScheduledJob>();
    private timers = new Map<string, ReturnType<typeof setInterval>>();
    private history: JobResult[] = [];
    private maxHistory = 200;
    private idCounter = 0;

    /**
     * Schedule a recurring job.
     */
    schedule(name: string, intervalMs: number, handler: () => Promise<void> | void, maxRuns?: number): string {
        const id = `job-${++this.idCounter}`;
        const job: ScheduledJob = {
            id, name, intervalMs, handler, status: 'active',
            nextRun: Date.now() + intervalMs, runCount: 0, maxRuns, errors: 0,
        };
        this.jobs.set(id, job);

        const timer = setInterval(async () => { await this.runJob(id); }, intervalMs);
        this.timers.set(id, timer);

        return id;
    }

    /**
     * Schedule a one-shot timer.
     */
    scheduleOnce(name: string, delayMs: number, handler: () => Promise<void> | void): string {
        const id = `once-${++this.idCounter}`;
        const job: ScheduledJob = {
            id, name, intervalMs: delayMs, handler, status: 'active',
            nextRun: Date.now() + delayMs, runCount: 0, maxRuns: 1, errors: 0,
        };
        this.jobs.set(id, job);

        const timer = setTimeout(async () => {
            await this.runJob(id);
            this.cancel(id);
        }, delayMs);
        this.timers.set(id, timer as unknown as ReturnType<typeof setInterval>);

        return id;
    }

    /**
     * Pause a job.
     */
    pause(jobId: string): boolean {
        const job = this.jobs.get(jobId);
        if (!job || job.status !== 'active') return false;
        const timer = this.timers.get(jobId);
        if (timer) clearInterval(timer);
        this.timers.delete(jobId);
        job.status = 'paused';
        return true;
    }

    /**
     * Resume a paused job.
     */
    resume(jobId: string): boolean {
        const job = this.jobs.get(jobId);
        if (!job || job.status !== 'paused') return false;
        job.status = 'active';
        const timer = setInterval(async () => { await this.runJob(jobId); }, job.intervalMs);
        this.timers.set(jobId, timer);
        return true;
    }

    /**
     * Cancel a job.
     */
    cancel(jobId: string): boolean {
        const timer = this.timers.get(jobId);
        if (timer) clearInterval(timer);
        this.timers.delete(jobId);
        const job = this.jobs.get(jobId);
        if (job) job.status = 'stopped';
        return this.jobs.delete(jobId);
    }

    /**
     * Get job info.
     */
    get(jobId: string): ScheduledJob | null {
        return this.jobs.get(jobId) ?? null;
    }

    /**
     * List all jobs.
     */
    list(): Array<{ id: string; name: string; status: string; runCount: number }> {
        return Array.from(this.jobs.values()).map((j) => ({
            id: j.id, name: j.name, status: j.status, runCount: j.runCount,
        }));
    }

    /**
     * Get job history.
     */
    getHistory(limit?: number): JobResult[] {
        return this.history.slice(-(limit ?? 50));
    }

    /**
     * Stop all jobs.
     */
    stopAll(): number {
        let count = 0;
        for (const [id] of Array.from(this.timers)) {
            this.cancel(id);
            count++;
        }
        return count;
    }

    /** Count */
    count(): number { return this.jobs.size; }

    // === Private ===

    private async runJob(jobId: string): Promise<void> {
        const job = this.jobs.get(jobId);
        if (!job || job.status !== 'active') return;

        const start = Date.now();
        try {
            await job.handler();
            job.runCount++;
            job.lastRun = Date.now();
            job.nextRun = Date.now() + job.intervalMs;
            this.recordHistory({ jobId, success: true, durationMs: Date.now() - start, timestamp: Date.now() });

            if (job.maxRuns && job.runCount >= job.maxRuns) {
                this.cancel(jobId);
            }
        } catch (err) {
            job.errors++;
            this.recordHistory({ jobId, success: false, durationMs: Date.now() - start, error: String(err), timestamp: Date.now() });
        }
    }

    private recordHistory(result: JobResult): void {
        this.history.push(result);
        if (this.history.length > this.maxHistory) this.history = this.history.slice(-this.maxHistory);
    }
}
