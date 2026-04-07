import { describe, it, expect } from "vitest";
import { normalizeCronJobCreate, normalizeCronJobPatch } from "../../src/cron/normalize.js";

describe("cron normalize", () => {
  it("normalizes create properly", () => {
    const job = normalizeCronJobCreate({
      name: "Test Job",
      schedule: { kind: "every", intervalMs: 1000 },
      payload: { type: "text", text: "hello" },
      sessionTarget: "target1"
    });
    
    expect(job).not.toBeNull();
    expect(job?.name).toBe("Test Job");
    expect(job?.enabled).toBe(true);
  });

  it("normalizes patch properly", () => {
    const patch = normalizeCronJobPatch({
      enabled: false,
    });
    
    expect(patch).not.toBeNull();
    expect(patch?.enabled).toBe(false);
  });
});
