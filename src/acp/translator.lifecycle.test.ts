import { describe, expect, it, vi } from "vitest";
import type { GatewayClient } from "../gateway/client.js";
import { createSessionAgentHarness } from "./translator.prompt-harness.test-support.js";

describe("ACP translator lifecycle", () => {
  it("creates an isolated session with the requested cwd", () => {
    const { sessionId, sessionKey, sessionStore } = createSessionAgentHarness(
      vi.fn(async () => ({})) as GatewayClient["request"],
      { cwd: "/workspace" },
    );
    expect(sessionStore.getSession(sessionId)).toMatchObject({ sessionKey, cwd: "/workspace" });
  });
});
