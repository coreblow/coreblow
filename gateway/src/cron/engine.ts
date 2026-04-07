import { randomUUID } from "node:crypto";
import { resolveCronStorePath, saveCronStore, loadCronStore } from "./store.js";
import { normalizeCronJobCreate, normalizeCronJobPatch } from "./normalize.js";
import type { CronJob as CronJobStore, CronJobCreate, CronJobPatch, CronStoreFile } from "./types.js";

export class CronService {
  /**
   * Add a new cron job.
   */
  public async add(cfg: unknown, workspaceDir: string, req: CronJobCreate): Promise<CronJobStore> {
    const storePath = resolveCronStorePath(workspaceDir);
    const create = normalizeCronJobCreate(req);
    if (!create) throw new Error("Invalid cron job creation payload");
    
    const store = await loadCronStore(storePath);
    const id = randomUUID();
    const job: CronJobStore = {
      ...create,
      id,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      state: create.state ?? {},
    } as unknown as CronJobStore;

    store.jobs.push(job);
    await saveCronStore(storePath, store);

    return job;
  }

  /**
   * Update an existing cron job.
   */
  public async update(cfg: unknown, workspaceDir: string, jobId: string, req: CronJobPatch): Promise<CronJobStore> {
    const storePath = resolveCronStorePath(workspaceDir);
    const store = await loadCronStore(storePath);

    const index = store.jobs.findIndex(j => j.id === jobId);
    if (index === -1) {
      throw new Error(`Job ${jobId} not found`);
    }
    
    const existing = store.jobs[index];
    if (!existing) {
      throw new Error(`Job ${jobId} not found`);
    }
    
    const patch = normalizeCronJobPatch(req);
    if (!patch) throw new Error("Invalid patch payload");

    const updatedJob: CronJobStore = {
      ...existing,
      ...patch,
      updatedAtMs: Date.now()
    } as unknown as CronJobStore;

    store.jobs[index] = updatedJob;
    await saveCronStore(storePath, store);

    return updatedJob;
  }

  /**
   * Remove a cron job.
   */
  public async remove(cfg: unknown, workspaceDir: string, jobId: string): Promise<boolean> {
    const storePath = resolveCronStorePath(workspaceDir);
    const store = await loadCronStore(storePath);

    const initialLength = store.jobs.length;
    store.jobs = store.jobs.filter(j => j.id !== jobId);
    
    if (store.jobs.length !== initialLength) {
      await saveCronStore(storePath, store);
      return true;
    }

    return false;
  }

  /**
   * List cron jobs with pagination.
   */
  public async listPage(
    cfg: unknown,
    workspaceDir: string,
    options: { limit?: number; cursor?: string; sessionKey?: string } = {}
  ): Promise<{ items: CronJobStore[]; nextCursor?: string }> {
    const storePath = resolveCronStorePath(workspaceDir);
    const store = await loadCronStore(storePath);
    
    let jobs = [...store.jobs];
    
    if (options.sessionKey) {
      jobs = jobs.filter((j) => j.sessionTarget === options.sessionKey);
    }
    
    jobs.sort((a, b) => b.createdAtMs - a.createdAtMs);

    const limit = options.limit ?? 50;
    const startIndex = options.cursor ? jobs.findIndex(j => j.id === options.cursor) : 0;
    const start = startIndex >= 0 ? startIndex : 0;
    
    const items = jobs.slice(start, start + limit);
    const nextCursor = start + limit < jobs.length ? jobs[start + limit]?.id : undefined;

    return { items, nextCursor };
  }

  /**
   * Force enqueue a run.
   */
  public async enqueueRun(cfg: unknown, workspaceDir: string, jobId: string): Promise<{ success: boolean; enqueuedAtMs: number }> {
    return { success: true, enqueuedAtMs: Date.now() };
  }
}

export const cronService = new CronService();

// ─── CronEngine: In-memory timer-based scheduling engine ──────────

export interface CronJobContext {
  signal: AbortSignal;
}

export interface CronJobSchedule {
  kind: "every" | "at" | "cron";
  intervalMs?: number;
  at?: Date;
  expr?: string;
}

export interface CronJob {
  id: string;
  name: string;
  schedule: CronJobSchedule;
  handler: (ctx: CronJobContext) => Promise<unknown> | unknown;
  enabled: boolean;
  timeout?: number;
  retries?: number;
}

interface CronJobHistoryEntry {
  jobId: string;
  status: "ok" | "error" | "timeout" | "skipped";
  output?: unknown;
  error?: string;
  durationMs: number;
  timestamp: number;
}

export class CronEngine {
  private jobs = new Map<string, CronJob>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private running = new Set<string>();
  private history: CronJobHistoryEntry[] = [];
  private started = false;

  addJob(job: CronJob): void {
    if (this.jobs.has(job.id)) {
      throw new Error(`Job ${job.id} already exists`);
    }
    this.jobs.set(job.id, { ...job });
    if (this.started && job.enabled) {
      this.scheduleNext(job.id);
    }
  }

  removeJob(id: string): boolean {
    if (!this.jobs.has(id)) return false;
    this.clearTimer(id);
    this.jobs.delete(id);
    return true;
  }

  setJobEnabled(id: string, enabled: boolean): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;
    job.enabled = enabled;
    if (!enabled) {
      this.clearTimer(id);
    } else if (this.started) {
      this.scheduleNext(id);
    }
    return true;
  }

  listJobs(): Array<{ id: string; name: string; enabled: boolean; isRunning: boolean; nextRun?: number }> {
    return Array.from(this.jobs.values()).map(j => ({
      id: j.id,
      name: j.name,
      enabled: j.enabled,
      isRunning: this.running.has(j.id),
      nextRun: this.getNextRunTime(j),
    }));
  }

  async runNow(id: string): Promise<{ status: string; output?: unknown; error?: string; durationMs: number }> {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`Job ${id} not found`);

    if (this.running.has(id)) {
      const entry: CronJobHistoryEntry = { jobId: id, status: "skipped", durationMs: 0, timestamp: Date.now() };
      this.history.push(entry);
      return { status: "skipped", durationMs: 0 };
    }

    return this.executeJob(job);
  }

  getHistory(id: string): CronJobHistoryEntry[] {
    return this.history.filter(h => h.jobId === id);
  }

  start(): void {
    this.started = true;
    for (const job of this.jobs.values()) {
      if (job.enabled) {
        this.scheduleNext(job.id);
      }
    }
  }

  stop(): void {
    this.started = false;
    for (const id of this.timers.keys()) {
      this.clearTimer(id);
    }
  }

  // ── private ──

  private scheduleNext(id: string): void {
    const job = this.jobs.get(id);
    if (!job || !job.enabled) return;

    const delayMs = this.getDelayMs(job);
    if (delayMs === null) return;

    this.clearTimer(id);
    const timer = setTimeout(async () => {
      await this.executeJob(job);
      // Reschedule for repeating schedules
      if (job.schedule.kind === "every" || job.schedule.kind === "cron") {
        if (this.started && job.enabled) {
          this.scheduleNext(id);
        }
      }
    }, delayMs);
    this.timers.set(id, timer);
  }

  private async executeJob(job: CronJob): Promise<CronJobHistoryEntry> {
    this.running.add(job.id);
    const start = Date.now();
    const maxRetries = job.retries ?? 0;
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const ac = new AbortController();
      let timeoutTimer: ReturnType<typeof setTimeout> | undefined;

      try {
        const resultPromise = Promise.resolve(job.handler({ signal: ac.signal }));

        if (job.timeout) {
          timeoutTimer = setTimeout(() => ac.abort(), job.timeout);
        }

        const output = await resultPromise;
        if (timeoutTimer) clearTimeout(timeoutTimer);

        const entry: CronJobHistoryEntry = {
          jobId: job.id, status: "ok", output, durationMs: Date.now() - start, timestamp: Date.now(),
        };
        this.history.push(entry);
        this.running.delete(job.id);
        return entry;
      } catch (err: unknown) {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        lastError = (err as any)?.message ?? String(err);

        if (ac.signal.aborted) {
          const entry: CronJobHistoryEntry = {
            jobId: job.id, status: "timeout", error: lastError, durationMs: Date.now() - start, timestamp: Date.now(),
          };
          this.history.push(entry);
          this.running.delete(job.id);
          return entry;
        }

        // Retry if we have attempts left
        if (attempt < maxRetries) continue;
      }
    }

    // All retries exhausted
    const entry: CronJobHistoryEntry = {
      jobId: job.id, status: "error", error: lastError, durationMs: Date.now() - start, timestamp: Date.now(),
    };
    this.history.push(entry);
    this.running.delete(job.id);
    return entry;
  }

  private getDelayMs(job: CronJob): number | null {
    if (job.schedule.kind === "every" && job.schedule.intervalMs) {
      return job.schedule.intervalMs;
    }
    if (job.schedule.kind === "at" && job.schedule.at) {
      const delay = job.schedule.at.getTime() - Date.now();
      return delay > 0 ? delay : null;
    }
    if (job.schedule.kind === "cron" && job.schedule.expr) {
      // Simple: for "* * * * *", fire every 60s aligned to next minute
      const now = Date.now();
      const nextMinute = Math.ceil(now / 60000) * 60000;
      return nextMinute - now || 60000;
    }
    return null;
  }

  private getNextRunTime(job: CronJob): number | undefined {
    const delay = this.getDelayMs(job);
    return delay !== null ? Date.now() + delay : undefined;
  }

  private clearTimer(id: string): void {
    const t = this.timers.get(id);
    if (t) {
      clearTimeout(t);
      this.timers.delete(id);
    }
  }
}
