import { describe, it, expect } from "vitest";
import { validateScheduleTimestamp } from "./validate-timestamp.js";

describe("validateScheduleTimestamp", () => {
  const now = Date.now();

  it("accepts non-at schedules without validation", () => {
    expect(validateScheduleTimestamp({ kind: "every" } as any, now)).toEqual({ ok: true });
    expect(validateScheduleTimestamp({ kind: "cron" } as any, now)).toEqual({ ok: true });
  });

  it("accepts timestamps within valid range", () => {
    const futureIso = new Date(now + 60_000).toISOString();
    const result = validateScheduleTimestamp({ kind: "at", at: futureIso } as any, now);
    expect(result.ok).toBe(true);
  });

  it("accepts timestamps within 1-minute grace period (just past)", () => {
    // 30 seconds ago is within the 1-minute grace period
    const justPast = new Date(now - 30_000).toISOString();
    const result = validateScheduleTimestamp({ kind: "at", at: justPast } as any, now);
    expect(result.ok).toBe(true);
  });

  it("rejects timestamps more than 1 minute in the past", () => {
    const oldIso = new Date(now - 120_000).toISOString(); // 2 minutes ago
    const result = validateScheduleTimestamp({ kind: "at", at: oldIso } as any, now);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("in the past");
    }
  });

  it("rejects timestamps more than 10 years in the future", () => {
    const farFuture = new Date(now + 11 * 365.25 * 24 * 60 * 60 * 1000).toISOString();
    const result = validateScheduleTimestamp({ kind: "at", at: farFuture } as any, now);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("too far in the future");
    }
  });

  it("rejects invalid/unparseable timestamps", () => {
    const result = validateScheduleTimestamp({ kind: "at", at: "not-a-date" } as any, now);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Invalid schedule.at");
    }
  });

  it("rejects empty at value", () => {
    const result = validateScheduleTimestamp({ kind: "at", at: "" } as any, now);
    expect(result.ok).toBe(false);
  });

  it("rejects non-string at value", () => {
    const result = validateScheduleTimestamp({ kind: "at", at: 12345 } as any, now);
    expect(result.ok).toBe(false);
  });
});
