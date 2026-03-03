import { describe, expect, it } from "vitest";
import type { CronJobBase } from "./types-shared.js";

// Use type-level testing via runtime object construction
type TestSchedule = { kind: "every"; everyMs: number };
type TestTarget = "isolated" | "main";
type TestWakeMode = "now" | "next-heartbeat";
type TestPayload = { kind: "agentTurn"; message: string };
type TestDelivery = { mode: "announce" };
type TestAlert = false;

type TestCronJob = CronJobBase<
  TestSchedule,
  TestTarget,
  TestWakeMode,
  TestPayload,
  TestDelivery,
  TestAlert
>;

function makeTestJob(overrides: Partial<TestCronJob> = {}): TestCronJob {
  return {
    id: "job-1",
    name: "Test Job",
    enabled: true,
    createdAtMs: 1000,
    updatedAtMs: 2000,
    schedule: { kind: "every", everyMs: 60_000 },
    sessionTarget: "isolated",
    wakeMode: "now",
    payload: { kind: "agentTurn", message: "hello" },
    ...overrides,
  };
}

describe("CronJobBase type shape", () => {
  it("can construct a valid job object", () => {
    const job = makeTestJob();
    expect(job).toBeDefined();
  });

  it("has required id field", () => {
    const job = makeTestJob();
    expect(typeof job.id).toBe("string");
  });

  it("has required name field", () => {
    const job = makeTestJob();
    expect(typeof job.name).toBe("string");
  });

  it("has required enabled field (boolean)", () => {
    const job = makeTestJob();
    expect(typeof job.enabled).toBe("boolean");
  });

  it("has required createdAtMs field (number)", () => {
    const job = makeTestJob();
    expect(typeof job.createdAtMs).toBe("number");
  });

  it("has required updatedAtMs field (number)", () => {
    const job = makeTestJob();
    expect(typeof job.updatedAtMs).toBe("number");
  });

  it("has required schedule field", () => {
    const job = makeTestJob();
    expect(typeof job.schedule).toBe("object");
    expect(job.schedule).not.toBeNull();
  });

  it("has required sessionTarget field", () => {
    const job = makeTestJob();
    expect(["isolated", "main"]).toContain(job.sessionTarget);
  });

  it("has required payload field", () => {
    const job = makeTestJob();
    expect(typeof job.payload).toBe("object");
  });

  it("optional fields (agentId, sessionKey, description) are undefined by default", () => {
    const job = makeTestJob();
    expect(job.agentId).toBeUndefined();
    expect(job.sessionKey).toBeUndefined();
    expect(job.description).toBeUndefined();
  });

  it("enabled=false is valid", () => {
    const job = makeTestJob({ enabled: false });
    expect(job.enabled).toBe(false);
  });

  it("deleteAfterRun optional field can be set", () => {
    const job = makeTestJob({ deleteAfterRun: true });
    expect(job.deleteAfterRun).toBe(true);
  });
});
