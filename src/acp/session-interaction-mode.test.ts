import { describe, expect, it } from "vitest";
import type { SessionEntry } from "../config/sessions/types.js";
import {
  isParentOwnedBackgroundAcpSession,
  isRequesterParentOfBackgroundAcpSession,
} from "./session-interaction-mode.js";

describe("ACP session interaction mode", () => {
  const child = {
    acp: {
      agent: "worker",
      backend: "default",
      runtimeSessionName: "worker",
      mode: "persistent",
      state: "idle",
      lastActivityAt: 1,
    },
    spawnedBy: "agent:main:main",
    parentSessionKey: undefined,
  } as unknown as SessionEntry;

  it("identifies parent-owned background sessions", () => {
    expect(isParentOwnedBackgroundAcpSession(child)).toBe(true);
    expect(isRequesterParentOfBackgroundAcpSession(child, "agent:main:main")).toBe(true);
    expect(isRequesterParentOfBackgroundAcpSession(child, "agent:other:main")).toBe(false);
  });
});
