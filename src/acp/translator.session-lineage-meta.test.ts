import { describe, expect, it } from "vitest";
import { toAcpSessionLineageMeta } from "./session-lineage-meta.js";

describe("ACP translator session lineage metadata", () => {
  it("falls back to spawnedBy when parentSessionKey is absent", () => {
    expect(
      toAcpSessionLineageMeta({
        key: "agent:worker:main",
        kind: "unknown",
        channel: undefined,
        parentSessionKey: undefined,
        spawnedBy: "agent:main:main",
        spawnDepth: undefined,
        subagentRole: undefined,
        subagentControlScope: undefined,
        spawnedWorkspaceDir: undefined,
      }).parentSessionId,
    ).toBe("agent:main:main");
  });
});
