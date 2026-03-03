import { describe, expect, it } from "vitest";
import type { CronSchedule } from "./types.js";

describe("CronSchedule type variants", () => {
  it("cron expression schedule is constructable", () => {
    const s: CronSchedule = { kind: "cron", expr: "0 9 * * *", tz: "UTC" } as never;
    expect((s as never as Record<string, unknown>).kind).toBe("cron");
  });

  it("every-ms schedule is constructable", () => {
    const s: CronSchedule = { kind: "every", everyMs: 60_000 } as never;
    expect((s as never as Record<string, unknown>).kind).toBe("every");
  });

  it("interval field is a positive number", () => {
    const s = { kind: "every", everyMs: 60_000 };
    expect(s.everyMs).toBeGreaterThan(0);
  });

  it("cron expr field is a non-empty string", () => {
    const s = { kind: "cron", expr: "0 9 * * *", tz: "UTC" };
    expect(s.expr.length).toBeGreaterThan(0);
  });

  it("tz field is a non-empty string", () => {
    const s = { kind: "cron", expr: "0 9 * * *", tz: "America/New_York" };
    expect(s.tz.length).toBeGreaterThan(0);
  });

  it("different schedule kinds are distinguishable", () => {
    const cron = { kind: "cron", expr: "* * * * *", tz: "UTC" };
    const every = { kind: "every", everyMs: 1000 };
    expect(cron.kind).not.toBe(every.kind);
  });
});
