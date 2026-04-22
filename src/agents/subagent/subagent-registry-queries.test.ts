/**
 * src/agents/subagent/subagent-registry-queries.test.ts
 *
 * CoreBlow — Subagent Registry Queries Tests
 */
import { describe, expect, it } from "vitest";
import { isActiveRun, isEndedRun, isArchivedRun } from "./subagent-registry-queries.js";
import type { SubagentRunRecord } from "./subagent-registry-types.js";

function makeRun(overrides: Partial<SubagentRunRecord> = {}): SubagentRunRecord {
  return { runId: "r1", sessionKey: "s1", requesterSessionKey: "s1", createdAt: Date.now(), ...overrides } as SubagentRunRecord;
}

describe("isActiveRun()", () => {
  it("true when endedAt not set", () => expect(isActiveRun(makeRun())).toBe(true));
  it("false when endedAt is number", () => expect(isActiveRun(makeRun({ endedAt: Date.now() }))).toBe(false));
});

describe("isEndedRun()", () => {
  it("false when endedAt not set", () => expect(isEndedRun(makeRun())).toBe(false));
  it("true when endedAt is number", () => expect(isEndedRun(makeRun({ endedAt: Date.now() }))).toBe(true));
});

describe("isArchivedRun()", () => {
  it("false when cleanupCompletedAt not set", () => expect(isArchivedRun(makeRun())).toBe(false));
  it("true when cleanupCompletedAt is number", () => expect(isArchivedRun(makeRun({ cleanupCompletedAt: Date.now() }))).toBe(true));
});

describe("state transitions", () => {
  it("active run is not ended or archived", () => {
    const r = makeRun();
    expect(isActiveRun(r)).toBe(true);
    expect(isEndedRun(r)).toBe(false);
    expect(isArchivedRun(r)).toBe(false);
  });

  it("archived run is also ended", () => {
    const r = makeRun({ endedAt: Date.now(), cleanupCompletedAt: Date.now() });
    expect(isEndedRun(r)).toBe(true);
    expect(isArchivedRun(r)).toBe(true);
  });
});
