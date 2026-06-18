import { describe, expect, it } from "vitest";
import { toAcpSessionLineageMeta } from "./session-lineage-meta.js";

describe("ACP session lineage metadata", () => {
  it("normalizes valid lineage fields and drops malformed values", () => {
    expect(
      toAcpSessionLineageMeta({
        key: "agent:worker:main",
        kind: "direct",
        channel: "web",
        parentSessionKey: "agent:main:main",
        spawnedBy: "agent:main:main",
        spawnDepth: 1,
        subagentRole: "leaf",
        subagentControlScope: "none",
        spawnedWorkspaceDir: "/workspace",
      }),
    ).toMatchObject({
      sessionKey: "agent:worker:main",
      parentSessionId: "agent:main:main",
      spawnDepth: 1,
      subagentRole: "leaf",
    });
  });
});
