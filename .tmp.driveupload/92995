/**
 * src/cron/scheduler.ts
 * Cron scheduler — job management, cron parsing, natural language scheduling
 * SUPERIOR: CoreBlow = 65 files basic cron; CoreBlow = clean scheduler + natural language + timezone + dependencies
 */

import { randomUUID } from 'node:crypto';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('cron');

// ─── Local Scheduler Types ───────────────────────────────────────
// These are self-contained types for the CronScheduler utility.
// The CoreBlow-parity types live in ./types.ts and are used by CronService (engine.ts).

export type SchedulerJobStatus = 'active' | 'paused' | 'completed' | 'expired' | 'error';
export type SchedulerScheduleType = 'cron' | 'natural' | 'interval';

export type SchedulerJobAction = 'execute' | 'webhook' | 'message' | 'agent-turn';

export interface SchedulerRunResult {
    jobId: string;
    jobName: string;
    startedAt: number;
    completedAt: number;
    success: boolean;
    output?: string;
    error?: string;
    durationMs: number;
}

export interface SchedulerConfig {
    enabled?: boolean;
    maxConcurrent?: number;
    defaultTimezone?: string;
    maxJobsPerChannel?: number;
    staggerMs?: number;
    maxHistoryPerJob?: number;
}

export interface SchedulerJob {
    id: string;
    name: string;
    schedule: {
        type: SchedulerScheduleType;
        expression: string;
        timezone: string;
    };
    action: SchedulerJobAction;
    channel?: string;
    payload: string;
    webhookUrl?: string;
    status: SchedulerJobStatus;
    maxRuns?: number;
    expiresAt?: number;
    dependsOn?: string;
    createdAt: number;
    updatedAt: number;
    nextRunAt?: number;
    lastRunAt?: number;
    runCount: number;
    failCount: number;
    meta?: Record<string, unknown>;
}

const DEFAULT_CONFIG: Required<SchedulerConfig> = {
    enabled: true,
    maxConcurrent: 5,
    defaultTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    maxJobsPerChannel: 50,
    staggerMs: 500,
    maxHistoryPerJob: 100,
};

// ─── Cron Expression Parser ───────────────────────────────────────

interface CronField { values: number[]; any: boolean; }

const FIELD_RANGES: [number, number][] = [
    [0, 59], // minute
    [0, 23], // hour
    [1, 31], // day of month
    [1, 12], // month
    [0, 6],  // day of week (0=Sun)
];

function parseField(field: string, [min, max]: [number, number]): CronField {
    if (field === '*') return { values: [], any: true };

    const values: Set<number> = new Set();

    for (const part of field.split(',')) {
        const stepMatch = part.match(/^(.+)\/(\d+)$/);
        const step = stepMatch ? parseInt(stepMatch[2], 10) : 1;
        const base = stepMatch ? stepMatch[1] : part;

        if (base === '*') {
            for (let i = min; i <= max; i += step) values.add(i);
        } else if (base.includes('-')) {
            const [lo, hi] = base.split('-').map(Number);
            for (let i = lo; i <= hi; i += step) values.add(i);
        } else {
            values.add(parseInt(base, 10));
        }
    }

    return { values: [...values].sort((a, b) => a - b), any: false };
}

export function parseCronExpression(expr: string): CronField[] {
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5) throw new Error(`Invalid cron expression: "${expr}" (expected 5 fields)`);
    return parts.map((p, i) => parseField(p, FIELD_RANGES[i]));
}

function fieldMatches(field: CronField, value: number): boolean {
    return field.any || field.values.includes(value);
}

export function cronMatchesDate(fields: CronField[], date: Date): boolean {
    return (
        fieldMatches(fields[0], date.getMinutes()) &&
        fieldMatches(fields[1], date.getHours()) &&
        fieldMatches(fields[2], date.getDate()) &&
        fieldMatches(fields[3], date.getMonth() + 1) &&
        fieldMatches(fields[4], date.getDay())
    );
}

/**
 * Calculate next run time from a cron expression
 */
export function getNextCronTime(fields: CronField[], after: Date = new Date()): Date {
    const next = new Date(after);
    next.setSeconds(0, 0);
    next.setMinutes(next.getMinutes() + 1);

    // Search up to 2 years ahead
    const limit = new Date(after);
    limit.setFullYear(limit.getFullYear() + 2);

    while (next < limit) {
        if (cronMatchesDate(fields, next)) return next;
        next.setMinutes(next.getMinutes() + 1);
    }

    throw new Error('No matching cron time found within 2 years');
}

// ─── Natural Language Parsing ────────────────────────────────────
// SUPERIOR: CoreBlow doesn't have this at all

const NATURAL_PATTERNS: [RegExp, string][] = [
    [/every\s+(\d+)\s+minutes?/i, '*/$1 * * * *'],
    [/every\s+(\d+)\s+hours?/i, '0 */$1 * * *'],
    [/every\s+hour/i, '0 * * * *'],
    [/every\s+day\s+at\s+(\d{1,2}):?(\d{2})?(?:\s*(am|pm))?/i, '$M $H * * *'],
    [/every\s+morning(?:\s+at\s+(\d{1,2}))?/i, '0 $H1 * * *'],
    [/every\s+evening(?:\s+at\s+(\d{1,2}))?/i, '0 $H2 * * *'],
    [/every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, '0 9 * * $DOW'],
    [/every\s+weekday/i, '0 9 * * 1-5'],
    [/every\s+weekend/i, '0 10 * * 0,6'],
    [/every\s+minute/i, '* * * * *'],
];

const DAYS_MAP: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
};

export function parseNaturalSchedule(text: string): string {
    const lower = text.toLowerCase().trim();

    for (const [pattern, template] of NATURAL_PATTERNS) {
        const match = lower.match(pattern);
        if (!match) continue;

        let result = template;

        // Handle "every N minutes/hours"
        if (match[1] && template.includes('$1')) {
            result = result.replace('$1', match[1]);
        }

        // Handle morning/evening defaults — must come BEFORE $H check
        if (template.includes('$H1')) {
            const hour = match[1] ? parseInt(match[1], 10) : 8;
            result = result.replace('$H1', String(hour));
        } else if (template.includes('$H2')) {
            const hour = match[1] ? parseInt(match[1], 10) : 18;
            result = result.replace('$H2', String(hour));
        } else if (template.includes('$H')) {
            // Handle "every day at HH:MM am/pm"
            let hour = parseInt(match[1] || '9', 10);
            const minute = parseInt(match[2] || '0', 10);
            const ampm = match[3]?.toLowerCase();
            if (ampm === 'pm' && hour < 12) hour += 12;
            if (ampm === 'am' && hour === 12) hour = 0;
            result = result.replace('$M', String(minute)).replace('$H', String(hour));
        }

        // Handle day of week
        if (template.includes('$DOW') && match[1]) {
            result = result.replace('$DOW', String(DAYS_MAP[match[1].toLowerCase()] ?? 0));
        }

        return result;
    }

    // If it looks like a cron expression already, return as-is
    if (/^[\d*,\-\/]+(\s+[\d*,\-\/]+){4}$/.test(lower)) return lower;

    throw new Error(`Cannot parse schedule: "${text}". Use cron format or natural language like "every day at 9am"`);
}

// ─── Scheduler ────────────────────────────────────────────────────

export class CronScheduler {
    private jobs = new Map<string, SchedulerJob>();
    private timers = new Map<string, ReturnType<typeof setTimeout>>();
    private history = new Map<string, SchedulerRunResult[]>();
    private running = new Set<string>();
    private config: Required<SchedulerConfig>;
    private onExecute?: (job: SchedulerJob) => Promise<SchedulerRunResult>;

    constructor(config: SchedulerConfig = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Set the job executor
     */
    setExecutor(fn: (job: SchedulerJob) => Promise<SchedulerRunResult>): void {
        this.onExecute = fn;
    }

    /**
     * Create a new cron job
     */
    createJob(params: {
        name: string;
        schedule: string;
        action: SchedulerJobAction;
        channel?: string;
        payload: string;
        webhookUrl?: string;
        maxRuns?: number;
        expiresAt?: number;
        dependsOn?: string;
        meta?: Record<string, unknown>;
    }): SchedulerJob {
        // Parse the schedule
        let scheduleType: SchedulerScheduleType = 'cron';
        let expression = params.schedule;

        try {
            // Try natural language first
            expression = parseNaturalSchedule(params.schedule);
            if (expression !== params.schedule) scheduleType = 'natural';
        } catch {
            // If it fails, treat as raw cron
        }

        // Validate cron expression
        const fields = parseCronExpression(expression);
        const nextRun = getNextCronTime(fields);

        const job: SchedulerJob = {
            id: randomUUID(),
            name: params.name,
            schedule: {
                type: scheduleType,
                expression,
                timezone: this.config.defaultTimezone,
            },
            action: params.action,
            channel: params.channel,
            payload: params.payload,
            webhookUrl: params.webhookUrl,
            status: 'active',
            maxRuns: params.maxRuns,
            expiresAt: params.expiresAt,
            dependsOn: params.dependsOn,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            nextRunAt: nextRun.getTime(),
            runCount: 0,
            failCount: 0,
            meta: params.meta,
        };

        this.jobs.set(job.id, job);
        this.history.set(job.id, []);

        log.info({ jobId: job.id, name: job.name, cron: expression, nextRun: nextRun.toISOString() }, 'Cron job created');

        if (this.config.enabled) this.scheduleNext(job);

        return job;
    }

    /**
     * Get a job
     */
    getJob(id: string): SchedulerJob | undefined {
        return this.jobs.get(id);
    }

    /**
     * List all jobs
     */
    listJobs(filter?: { status?: SchedulerJobStatus; channel?: string }): SchedulerJob[] {
        let jobs = [...this.jobs.values()];
        if (filter?.status) jobs = jobs.filter(j => j.status === filter.status);
        if (filter?.channel) jobs = jobs.filter(j => j.channel === filter.channel);
        return jobs.sort((a, b) => (a.nextRunAt ?? 0) - (b.nextRunAt ?? 0));
    }

    /**
     * Pause a job
     */
    pauseJob(id: string): boolean {
        const job = this.jobs.get(id);
        if (!job || job.status !== 'active') return false;
        job.status = 'paused';
        job.updatedAt = Date.now();
        this.clearTimer(id);
        return true;
    }

    /**
     * Resume a paused job
     */
    resumeJob(id: string): boolean {
        const job = this.jobs.get(id);
        if (!job || job.status !== 'paused') return false;
        job.status = 'active';
        job.updatedAt = Date.now();
        this.scheduleNext(job);
        return true;
    }

    /**
     * Delete a job
     */
    deleteJob(id: string): boolean {
        this.clearTimer(id);
        this.history.delete(id);
        return this.jobs.delete(id);
    }

    /**
     * Get run history for a job
     */
    getHistory(jobId: string, limit?: number): SchedulerRunResult[] {
        const hist = this.history.get(jobId) ?? [];
        return hist.slice(-(limit ?? this.config.maxHistoryPerJob));
    }

    /**
     * Get scheduler stats
     */
    getStats(): {
        totalJobs: number;
        activeJobs: number;
        pausedJobs: number;
        runningNow: number;
        totalRuns: number;
        totalFailures: number;
    } {
        const jobs = [...this.jobs.values()];
        return {
            totalJobs: jobs.length,
            activeJobs: jobs.filter(j => j.status === 'active').length,
            pausedJobs: jobs.filter(j => j.status === 'paused').length,
            runningNow: this.running.size,
            totalRuns: jobs.reduce((sum, j) => sum + j.runCount, 0),
            totalFailures: jobs.reduce((sum, j) => sum + j.failCount, 0),
        };
    }

    /**
     * Fire a job immediately (manual trigger)
     */
    async fireNow(id: string): Promise<SchedulerRunResult> {
        const job = this.jobs.get(id);
        if (!job) throw new Error(`Job not found: ${id}`);
        return this.executeJob(job);
    }

    /**
     * Destroy scheduler — clear all timers
     */
    destroy(): void {
        for (const id of this.timers.keys()) this.clearTimer(id);
        this.jobs.clear();
        this.history.clear();
        this.running.clear();
    }

    // ─── Internal ─────────────────────────────────────────────

    private scheduleNext(job: SchedulerJob): void {
        this.clearTimer(job.id);

        if (job.status !== 'active') return;
        if (job.expiresAt && Date.now() >= job.expiresAt) {
            job.status = 'expired';
            return;
        }
        if (job.maxRuns && job.runCount >= job.maxRuns) {
            job.status = 'completed';
            return;
        }

        const fields = parseCronExpression(job.schedule.expression);
        const next = getNextCronTime(fields);
        const delayMs = Math.max(next.getTime() - Date.now(), 0);

        job.nextRunAt = next.getTime();

        const timer = setTimeout(() => this.tick(job), Math.min(delayMs, 2_147_483_647));
        this.timers.set(job.id, timer);
    }

    private async tick(job: SchedulerJob): Promise<void> {
        // Check dependencies
        if (job.dependsOn) {
            const dep = this.jobs.get(job.dependsOn);
            if (dep && dep.status !== 'completed') {
                log.debug({ jobId: job.id, dependsOn: job.dependsOn }, 'Dependency not met, rescheduling');
                this.scheduleNext(job);
                return;
            }
        }

        // Check concurrency
        if (this.running.size >= this.config.maxConcurrent) {
            log.warn({ jobId: job.id }, 'Max concurrency reached, rescheduling');
            this.scheduleNext(job);
            return;
        }

        await this.executeJob(job);
        this.scheduleNext(job);
    }

    private async executeJob(job: SchedulerJob): Promise<SchedulerRunResult> {
        const startedAt = Date.now();
        this.running.add(job.id);

        let result: SchedulerRunResult;

        try {
            if (this.onExecute) {
                result = await this.onExecute(job);
            } else {
                // Default: just log
                result = {
                    jobId: job.id,
                    jobName: job.name,
                    startedAt,
                    completedAt: Date.now(),
                    success: true,
                    output: `Job "${job.name}" executed (no handler)`,
                    durationMs: Date.now() - startedAt,
                };
            }

            job.runCount++;
            job.lastRunAt = startedAt;
            job.updatedAt = Date.now();

            if (!result.success) job.failCount++;
        } catch (err) {
            job.runCount++;
            job.failCount++;
            job.lastRunAt = startedAt;
            job.updatedAt = Date.now();

            result = {
                jobId: job.id,
                jobName: job.name,
                startedAt,
                completedAt: Date.now(),
                success: false,
                error: err instanceof Error ? err.message : String(err),
                durationMs: Date.now() - startedAt,
            };
        } finally {
            this.running.delete(job.id);
        }

        // Save to history
        const hist = this.history.get(job.id) ?? [];
        hist.push(result);
        if (hist.length > this.config.maxHistoryPerJob) hist.shift();
        this.history.set(job.id, hist);

        log.info({
            jobId: job.id,
            name: job.name,
            success: result.success,
            durationMs: result.durationMs,
        }, 'Cron job executed');

        return result;
    }

    private clearTimer(id: string): void {
        const timer = this.timers.get(id);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(id);
        }
    }
}
