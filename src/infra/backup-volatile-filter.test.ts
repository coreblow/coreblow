import { describe, expect, it } from "vitest";
import { isVolatileBackupPath } from "./backup-volatile-filter.js";

const stateDir = "/opt/coreblow/state";
const plan = { stateDirs: [stateDir] };

describe("isVolatileBackupPath", () => {
  it.each([
    [`${stateDir}/sessions/s-abc/transcript.jsonl`, true],
    [`${stateDir}/agents/main/sessions/transcript.jsonl`, true],
    [`${stateDir}/cron/runs/2026-01-01/job.log`, true],
    [`${stateDir}/logs/gateway.jsonl`, true],
    [`${stateDir}/delivery-queue/pending.json`, true],
    [`${stateDir}/session-delivery-queue/pending.tmp`, true],
    [`${stateDir}/gateway.pid`, true],
    [`${stateDir}/sessions/s-abc/meta.json`, false],
    [`${stateDir}/cron/jobs.json`, false],
    ["/home/user/project/pending.tmp", false],
  ])("classifies %s as volatile=%s", (p, expected) => {
    expect(isVolatileBackupPath(p, plan)).toBe(expected);
  });

  it("normalizes escaped and tar-style paths", () => {
    expect(isVolatileBackupPath(`${stateDir}/sessions/../config.jsonl`, plan)).toBe(false);
    expect(isVolatileBackupPath("opt/coreblow/state/agents/main/sessions/run.log", plan)).toBe(
      true,
    );
  });
});
