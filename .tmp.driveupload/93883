/**
 * Phase 25 — Test 4: Phase 19 (Cron Engine II)
 * Strict integration tests for the full cron subsystem.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CronEngine } from "../../src/cron/engine.js";
import type { CronJob, CronJobContext } from "../../src/cron/engine.js";
import { CronLock } from "../../src/cron/cron-lock.js";
import { CronHistory } from "../../src/cron/history.js";
import { parseSchedule, listPresets } from "../../src/cron/schedule.js";
import { shouldRun } from "../../src/cron/next-run.js";
import { computeNextRunAtMs } from "../../src/cron/schedule.js";

describe("Phase 19: Cron Engine II — Full Integration", () => {

    // ── CronLock ──
    describe("CronLock", () => {
        it("acquires and releases locks correctly", () => {
            const lock = new CronLock();
            expect(lock.acquire("j1")).toBe(true);
            expect(lock.acquire("j1")).toBe(false);
            lock.release("j1");
            expect(lock.acquire("j1")).toBe(true);
        });

        it("independent locks don't interfere", () => {
            const lock = new CronLock();
            expect(lock.acquire("a")).toBe(true);
            expect(lock.acquire("b")).toBe(true);
            expect(lock.acquire("a")).toBe(false);
            expect(lock.acquire("b")).toBe(false);
        });
    });

    // ── CronHistory ──
    describe("CronHistory", () => {
        it("records and retrieves by jobId", () => {
            const h = new CronHistory();
            h.record("j1", 100, true);
            h.record("j1", 200, false, "fail");
            expect(h.getByJob("j1")).toHaveLength(2);
        });

        it("getFailures returns only failures", () => {
            const h = new CronHistory();
            h.record("j1", 10, true);
            h.record("j2", 20, false, "err");
            expect(h.getFailures()).toHaveLength(1);
        });

        it("caps at 1000 entries per job", () => {
            const h = new CronHistory();
            for (let i = 0; i < 1100; i++) h.record("j1", 1, true);
            expect(h.getByJob("j1")).toHaveLength(1000);
        });
    });

    // ── Schedule Parsing ──
    describe("Schedule Parsing", () => {
        it("parses 'every hour'", () => {
            const r = parseSchedule("every hour");
            expect(r).not.toBeNull();
            expect(r!.cronExpr).toBe("0 * * * *");
        });

        it("parses 'every 5 minutes'", () => {
            const r = parseSchedule("every 5 minutes");
            expect(r!.cronExpr).toBe("*/5 * * * *");
        });

        it("parses 'daily at 9:30 am'", () => {
            const r = parseSchedule("daily at 9:30 am");
            expect(r!.cronExpr).toBe("30 9 * * *");
        });

        it("parses 'daily at 2:15 pm'", () => {
            const r = parseSchedule("daily at 2:15 pm");
            expect(r!.cronExpr).toBe("15 14 * * *");
        });

        it("parses raw cron expression", () => {
            const r = parseSchedule("0 0 * * *");
            expect(r!.cronExpr).toBe("0 0 * * *");
        });

        it("returns null for invalid input", () => {
            expect(parseSchedule("invalid")).toBeNull();
            expect(parseSchedule("every century")).toBeNull();
        });

        it("listPresets returns >10 presets", () => {
            expect(listPresets().length).toBeGreaterThan(10);
        });
    });

    // ── shouldRun ──
    describe("shouldRun", () => {
        it("returns true when interval elapsed", () => {
            expect(shouldRun(Date.now() - 60000, 30000)).toBe(true);
        });
        it("returns false when interval not elapsed", () => {
            expect(shouldRun(Date.now() - 10000, 30000)).toBe(false);
        });
    });

    // ── computeNextRunAtMs ──
    describe("computeNextRunAtMs", () => {
        it("computes next run for 'every' schedule", () => {
            const now = Date.now();
            const next = computeNextRunAtMs({ kind: "every", everyMs: 60000 }, now);
            expect(next).toBeDefined();
            expect(next!).toBeGreaterThan(now);
        });
    });

    // ── CronEngine full lifecycle ──
    describe("CronEngine Full Lifecycle", () => {
        let engine: CronEngine;

        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2024, 0, 1, 0, 0, 0));
            engine = new CronEngine();
        });

        afterEach(() => {
            engine.stop();
            vi.useRealTimers();
            vi.restoreAllMocks();
        });

        it("addJob + listJobs + removeJob complete lifecycle", () => {
            engine.addJob({ id: "j1", name: "Job 1", schedule: { kind: "every", intervalMs: 1000 }, handler: async () => "ok", enabled: true });
            expect(engine.listJobs()).toHaveLength(1);
            expect(engine.removeJob("j1")).toBe(true);
            expect(engine.listJobs()).toHaveLength(0);
        });

        it("start triggers handler on interval", async () => {
            const handler = vi.fn().mockResolvedValue("done");
            engine.addJob({ id: "j1", name: "J", schedule: { kind: "every", intervalMs: 1000 }, handler, enabled: true });
            engine.start();
            await vi.advanceTimersByTimeAsync(1100);
            expect(handler).toHaveBeenCalledTimes(1);
        });

        it("stop prevents further handler execution", async () => {
            const handler = vi.fn().mockResolvedValue("done");
            engine.addJob({ id: "j1", name: "J", schedule: { kind: "every", intervalMs: 1000 }, handler, enabled: true });
            engine.start();
            await vi.advanceTimersByTimeAsync(1100);
            engine.stop();
            await vi.advanceTimersByTimeAsync(2000);
            expect(handler).toHaveBeenCalledTimes(1);
        });

        it("runNow executes immediately", async () => {
            const handler = vi.fn().mockResolvedValue("result");
            engine.addJob({ id: "j1", name: "J", schedule: { kind: "every", intervalMs: 99999 }, handler, enabled: true });
            const r = await engine.runNow("j1");
            expect(r.status).toBe("ok");
            expect(handler).toHaveBeenCalled();
        });

        it("getHistory tracks runs", async () => {
            engine.addJob({ id: "j1", name: "J", schedule: { kind: "every", intervalMs: 99999 }, handler: async () => "x", enabled: true });
            await engine.runNow("j1");
            await engine.runNow("j1");
            expect(engine.getHistory("j1")).toHaveLength(2);
        });

        it("setJobEnabled disables then re-enables", () => {
            engine.addJob({ id: "j1", name: "J", schedule: { kind: "every", intervalMs: 1000 }, handler: async () => {}, enabled: true });
            expect(engine.setJobEnabled("j1", false)).toBe(true);
            expect(engine.listJobs()[0]!.enabled).toBe(false);
            expect(engine.setJobEnabled("j1", true)).toBe(true);
            expect(engine.listJobs()[0]!.enabled).toBe(true);
        });

        it("runNow throws for nonexistent job", async () => {
            await expect(engine.runNow("nope")).rejects.toThrow("not found");
        });
    });
});
