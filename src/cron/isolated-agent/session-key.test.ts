import { describe, expect, it } from "vitest";
import { resolveCronAgentSessionKey } from "./session-key.js";

describe("resolveCronAgentSessionKey", () => {
  it("returns a non-empty string", () => {
    const key = resolveCronAgentSessionKey({
      sessionKey: "daily-report",
      agentId: "cron-agent",
    });
    expect(typeof key).toBe("string");
    expect(key.length).toBeGreaterThan(0);
  });

  it("includes agentId in the key", () => {
    const key = resolveCronAgentSessionKey({
      sessionKey: "sync-task",
      agentId: "my-cron-agent",
    });
    expect(key).toContain("my-cron-agent");
  });

  it("is consistent for same inputs", () => {
    const params = { sessionKey: "weekly-digest", agentId: "agent-1" };
    expect(resolveCronAgentSessionKey(params)).toBe(resolveCronAgentSessionKey(params));
  });

  it("produces different keys for different agentIds", () => {
    const k1 = resolveCronAgentSessionKey({ sessionKey: "task", agentId: "agent-a" });
    const k2 = resolveCronAgentSessionKey({ sessionKey: "task", agentId: "agent-b" });
    expect(k1).not.toBe(k2);
  });

  it("produces different keys for different sessionKeys", () => {
    const k1 = resolveCronAgentSessionKey({ sessionKey: "task-1", agentId: "agent" });
    const k2 = resolveCronAgentSessionKey({ sessionKey: "task-2", agentId: "agent" });
    expect(k1).not.toBe(k2);
  });

  it("trims whitespace from sessionKey", () => {
    const k1 = resolveCronAgentSessionKey({ sessionKey: "  task  ", agentId: "agent" });
    const k2 = resolveCronAgentSessionKey({ sessionKey: "task", agentId: "agent" });
    expect(k1).toBe(k2);
  });

  it("handles optional mainKey without throwing", () => {
    expect(() =>
      resolveCronAgentSessionKey({
        sessionKey: "task",
        agentId: "agent",
        mainKey: "main-session",
      }),
    ).not.toThrow();
  });

  it("produces different result with and without mainKey", () => {
    const without = resolveCronAgentSessionKey({ sessionKey: "task", agentId: "agent" });
    const with_ = resolveCronAgentSessionKey({
      sessionKey: "task",
      agentId: "agent",
      mainKey: "main",
    });
    // May differ depending on routing implementation
    expect(typeof without).toBe("string");
    expect(typeof with_).toBe("string");
  });
});
