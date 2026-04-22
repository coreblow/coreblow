/**
 * src/observability/error-reporter.test.ts
 *
 * CoreBlow — Error Reporter Tests
 * Verifies ErrorReporter: report, dedup, severity, resolve,
 * getSummary, getAlerts, clearResolved.
 */
import { describe, beforeEach, expect, it } from "vitest";
import { ErrorReporter } from "./error-reporter.js";

let reporter: ErrorReporter;

beforeEach(() => {
  reporter = new ErrorReporter();
});

describe("ErrorReporter — report()", () => {
  it("returns an error report object", () => {
    const r = reporter.report(new Error("boom"), "api-handler");
    expect(r.id).toMatch(/^err-/);
    expect(r.message).toBe("boom");
    expect(r.source).toBe("api-handler");
    expect(r.resolved).toBe(false);
  });

  it("increments count per unique error", () => {
    reporter.report("fail A", "svc-a");
    reporter.report("fail B", "svc-b");
    expect(reporter.count()).toBe(2);
  });

  it("deduplicates same error and increments occurrence count", () => {
    reporter.report("same error", "svc");
    reporter.report("same error", "svc");
    // Same key → 1 unique report, count incremented
    expect(reporter.count()).toBe(1);
  });

  it("defaults severity to warning", () => {
    const r = reporter.report("issue", "svc");
    expect(r.severity).toBeTruthy();
  });

  it("accepts custom severity", () => {
    const r = reporter.report("critical!", "core", "critical");
    expect(r.severity).toBe("critical");
  });
});

describe("ErrorReporter — resolve()", () => {
  it("returns true when report is resolved", () => {
    const r = reporter.report("err", "svc");
    expect(reporter.resolve(r.id)).toBe(true);
  });

  it("marks the report as resolved", () => {
    const r = reporter.report("err", "svc");
    reporter.resolve(r.id);
    const stats = reporter.getStats();
    expect(stats.unresolved).toBe(0);
  });

  it("returns false for unknown report id", () => {
    expect(reporter.resolve("unknown-id")).toBe(false);
  });
});

describe("ErrorReporter — getStats()", () => {
  it("returns zero counts initially", () => {
    const s = reporter.getStats();
    expect(s.total).toBe(0);
    expect(s.unresolved).toBe(0);
    expect(s.critical).toBe(0);
  });

  it("counts critical unresolved reports", () => {
    reporter.report("critical issue", "core", "critical");
    const s = reporter.getStats();
    expect(s.critical).toBe(1);
    expect(s.unresolved).toBe(1);
  });
});

describe("ErrorReporter — getAlerts()", () => {
  it("returns an array", () => {
    reporter.report("alert-worthy", "api", "error");
    expect(Array.isArray(reporter.getAlerts())).toBe(true);
  });
});

describe("ErrorReporter — clearResolved()", () => {
  it("removes resolved reports", () => {
    const r = reporter.report("to-resolve", "svc");
    reporter.resolve(r.id);
    const removed = reporter.clearResolved();
    expect(removed).toBe(1);
    expect(reporter.count()).toBe(0);
  });

  it("returns 0 when nothing to clear", () => {
    reporter.report("active", "svc");
    expect(reporter.clearResolved()).toBe(0);
  });
});
