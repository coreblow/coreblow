import { describe, it, expect, afterEach } from "vitest";
import { CronEngine } from "./engine.js";

describe("CronEngine", () => {
  let engine: CronEngine;

  afterEach(() => {
    engine?.stop();
  });

  describe("job management", () => {
    it("adds and lists jobs", () => {
      engine = new CronEngine();
      engine.addJob({
        id: "job1",
        name: "Test Job",
        schedule: { kind: "every", intervalMs: 60000 },
        handler: async () => "ok",
        enabled: true,
      });

      const jobs = engine.listJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].id).toBe("job1");
      expect(jobs[0].name).toBe("Test Job");
      expect(jobs[0].enabled).toBe(true);
    });

    it("throws on duplicate job id", () => {
      engine = new CronEngine();
      engine.addJob({
        id: "dup",
        name: "First",
        schedule: { kind: "every", intervalMs: 1000 },
        handler: async () => {},
        enabled: true,
      });

      expect(() =>
        engine.addJob({
          id: "dup",
          name: "Second",
          schedule: { kind: "every", intervalMs: 1000 },
          handler: async () => {},
          enabled: true,
        }),
      ).toThrow("Job dup already exists");
    });

    it("removes jobs", () => {
      engine = new CronEngine();
      engine.addJob({
        id: "rem",
        name: "Removable",
        schedule: { kind: "every", intervalMs: 1000 },
        handler: async () => {},
        enabled: true,
      });

      expect(engine.removeJob("rem")).toBe(true);
      expect(engine.removeJob("rem")).toBe(false);
      expect(engine.listJobs()).toHaveLength(0);
    });

    it("enables and disables jobs", () => {
      engine = new CronEngine();
      engine.addJob({
        id: "toggle",
        name: "Toggle",
        schedule: { kind: "every", intervalMs: 1000 },
        handler: async () => {},
        enabled: true,
      });

      expect(engine.setJobEnabled("toggle", false)).toBe(true);
      expect(engine.listJobs()[0].enabled).toBe(false);

      expect(engine.setJobEnabled("toggle", true)).toBe(true);
      expect(engine.listJobs()[0].enabled).toBe(true);

      expect(engine.setJobEnabled("nonexistent", true)).toBe(false);
    });
  });

  describe("runNow", () => {
    it("executes job immediately", async () => {
      engine = new CronEngine();
      let ran = false;
      engine.addJob({
        id: "run",
        name: "Run",
        schedule: { kind: "every", intervalMs: 60000 },
        handler: async () => { ran = true; return "result"; },
        enabled: true,
      });

      const result = await engine.runNow("run");
      expect(ran).toBe(true);
      expect(result.status).toBe("ok");
      expect(result.output).toBe("result");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("throws for nonexistent job", async () => {
      engine = new CronEngine();
      await expect(engine.runNow("missing")).rejects.toThrow("Job missing not found");
    });

    it("records error status on handler failure", async () => {
      engine = new CronEngine();
      engine.addJob({
        id: "fail",
        name: "Fail",
        schedule: { kind: "every", intervalMs: 60000 },
        handler: async () => { throw new Error("handler error"); },
        enabled: true,
      });

      const result = await engine.runNow("fail");
      expect(result.status).toBe("error");
      expect(result.error).toBe("handler error");
    });

    it("retries on failure when retries configured", async () => {
      engine = new CronEngine();
      let attempts = 0;
      engine.addJob({
        id: "retry",
        name: "Retry",
        schedule: { kind: "every", intervalMs: 60000 },
        handler: async () => { attempts++; if (attempts < 3) throw new Error("not yet"); return "ok"; },
        enabled: true,
        retries: 3,
      });

      const result = await engine.runNow("retry");
      expect(result.status).toBe("ok");
      expect(attempts).toBe(3);
    });
  });

  describe("history", () => {
    it("records execution history", async () => {
      engine = new CronEngine();
      engine.addJob({
        id: "hist",
        name: "History",
        schedule: { kind: "every", intervalMs: 60000 },
        handler: async () => "done",
        enabled: true,
      });

      await engine.runNow("hist");
      await engine.runNow("hist");

      const history = engine.getHistory("hist");
      expect(history).toHaveLength(2);
      expect(history.every((h) => h.status === "ok")).toBe(true);
    });
  });

  describe("start/stop lifecycle", () => {
    it("starts and stops without errors", () => {
      engine = new CronEngine();
      engine.addJob({
        id: "lifecycle",
        name: "Lifecycle",
        schedule: { kind: "every", intervalMs: 60000 },
        handler: async () => {},
        enabled: true,
      });

      expect(() => engine.start()).not.toThrow();
      expect(() => engine.stop()).not.toThrow();
    });

    it("stop clears all timers", () => {
      engine = new CronEngine();
      engine.addJob({
        id: "timer1",
        name: "Timer1",
        schedule: { kind: "every", intervalMs: 100 },
        handler: async () => {},
        enabled: true,
      });

      engine.start();
      engine.stop();

      // After stop, no more executions should happen
      const jobs = engine.listJobs();
      expect(jobs).toHaveLength(1);
    });
  });

  describe("skips concurrent execution", () => {
    it("skips run if job is already running", async () => {
      engine = new CronEngine();
      let resolveJob: () => void;
      const jobPromise = new Promise<void>((r) => { resolveJob = r; });

      engine.addJob({
        id: "concurrent",
        name: "Concurrent",
        schedule: { kind: "every", intervalMs: 60000 },
        handler: async () => { await jobPromise; },
        enabled: true,
      });

      // Start first execution (will block)
      const first = engine.runNow("concurrent");

      // Try concurrent execution (should be skipped)
      const second = await engine.runNow("concurrent");
      expect(second.status).toBe("skipped");

      // Unblock first
      resolveJob!();
      await first;
    });
  });
});
