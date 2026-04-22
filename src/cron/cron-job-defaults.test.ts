/**
 * src/cron/cron-job-defaults.test.ts
 *
 * CoreBlow — Cron Job Fixtures Defaults Tests
 * Verifies default field values from makeIsolatedAgentJobFixture
 * and tests override patterns exhaustively.
 */
import { describe, expect, it } from "vitest";
import {
  makeIsolatedAgentJobFixture,
  makeIsolatedAgentParamsFixture,
} from "./isolated-agent/job-fixtures.js";

describe("makeIsolatedAgentJobFixture — defaults", () => {
  it("id default is a non-empty string", () => {
    const job = makeIsolatedAgentJobFixture();
    expect(job.id.length).toBeGreaterThan(0);
  });

  it("name default is a non-empty string", () => {
    const job = makeIsolatedAgentJobFixture();
    expect(job.name.length).toBeGreaterThan(0);
  });

  it("schedule.kind is cron", () => {
    const job = makeIsolatedAgentJobFixture();
    expect(job.schedule.kind).toBe("cron");
  });

  it("schedule.tz is UTC", () => {
    const job = makeIsolatedAgentJobFixture();
    expect((job.schedule as never as { tz: string }).tz).toBe("UTC");
  });

  it("payload.message is a non-empty string", () => {
    const job = makeIsolatedAgentJobFixture();
    expect(typeof (job.payload as never as { message: string }).message).toBe("string");
  });
});

describe("makeIsolatedAgentParamsFixture — defaults", () => {
  it("cfg is an object", () => {
    const params = makeIsolatedAgentParamsFixture();
    expect(typeof params.cfg).toBe("object");
  });

  it("message is a string", () => {
    const params = makeIsolatedAgentParamsFixture();
    expect(typeof params.message).toBe("string");
  });

  it("sessionKey is a non-empty string", () => {
    const params = makeIsolatedAgentParamsFixture();
    expect(params.sessionKey.length).toBeGreaterThan(0);
  });

  it("job.id matches expected default", () => {
    const params = makeIsolatedAgentParamsFixture();
    expect(params.job.id).toBe("test-job");
  });

  it("override message propagates", () => {
    const params = makeIsolatedAgentParamsFixture({ message: "custom-msg" });
    expect(params.message).toBe("custom-msg");
  });
});
