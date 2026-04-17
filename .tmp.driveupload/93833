import { describe, it, expect, vi } from "vitest";
import { normalizeCronStaggerMs, resolveDefaultCronStaggerMs, isRecurringTopOfHourCronExpr } from "../../src/cron/stagger.js";

describe("cron stagger", () => {
  it("normalizes stagger input", () => {
    expect(normalizeCronStaggerMs(0)).toBe(0);
    expect(normalizeCronStaggerMs(100)).toBe(100);
    expect(normalizeCronStaggerMs(undefined)).toBeUndefined();
    expect(normalizeCronStaggerMs(false)).toBeUndefined();
    expect(normalizeCronStaggerMs(true)).toBeUndefined(); // fallback to default
    expect(normalizeCronStaggerMs(-50)).toBe(0); // caps below 0
  });

  it("checks recursive top of hour", () => {
    expect(isRecurringTopOfHourCronExpr("0 * * * *")).toBe(true);
    expect(isRecurringTopOfHourCronExpr("1 * * * *")).toBe(false);
  });

  it("resolves default stagger ms fallback", () => {
    expect(resolveDefaultCronStaggerMs("0 * * * *")).toBeGreaterThan(0);
    expect(resolveDefaultCronStaggerMs("1 * * * *")).toBeUndefined();
  });
});
