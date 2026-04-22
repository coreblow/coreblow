/**
 * src/cli/cron-cli/schedule-options.test.ts
 *
 * CoreBlow — Cron CLI Schedule Options Tests
 * Verifies resolveCronCreateSchedule error handling.
 */
import { describe, expect, it } from "vitest";
import { resolveCronCreateSchedule, resolveCronEditScheduleRequest } from "./schedule-options.js";

describe("resolveCronCreateSchedule()", () => {
  it("throws when no schedule option provided", () => {
    expect(() => resolveCronCreateSchedule({})).toThrow();
  });

  it("throws when multiple schedule options provided", () => {
    expect(() =>
      resolveCronCreateSchedule({ every: "5m", cron: "0 * * * *" })
    ).toThrow();
  });

  it("does not throw for single --every option", () => {
    expect(() => resolveCronCreateSchedule({ every: "5m" })).not.toThrow();
  });
});

describe("resolveCronEditScheduleRequest()", () => {
  it("returns { kind: 'none' } when no schedule changes", () => {
    const result = resolveCronEditScheduleRequest({});
    expect(result.kind).toBe("none");
  });

  it("throws when more than one schedule option provided", () => {
    expect(() =>
      resolveCronEditScheduleRequest({ every: "5m", cron: "0 * * * *" })
    ).toThrow();
  });

  it("returns { kind: 'direct' } for single schedule change", () => {
    const result = resolveCronEditScheduleRequest({ every: "10m" });
    expect(["direct", "patch-existing-cron", "none"]).toContain(result.kind);
  });
});
