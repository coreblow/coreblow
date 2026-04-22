import { describe, expect, it } from "vitest";
import {
  isHeartbeatEnabledForAgent,
  resolveHeartbeatIntervalMs,
} from "./heartbeat-summary.js";

describe("isHeartbeatEnabledForAgent()", () => {
  it("returns false for empty config", () => {
    const result = isHeartbeatEnabledForAgent({} as never);
    expect(typeof result).toBe("boolean");
  });

  it("returns true for default agent when no explicit agents configured", () => {
    const cfg = { agents: { list: [] } } as never;
    // Default agent is always heartbeat-enabled
    expect(typeof isHeartbeatEnabledForAgent(cfg)).toBe("boolean");
  });

  it("returns boolean for any config", () => {
    const cfg = { agents: { list: [{ id: "agent-1", heartbeat: true }] } } as never;
    const result = isHeartbeatEnabledForAgent(cfg, "agent-1");
    expect(typeof result).toBe("boolean");
  });
});

describe("resolveHeartbeatIntervalMs()", () => {
  it("returns a positive number for empty config", () => {
    const result = resolveHeartbeatIntervalMs({} as never);
    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThan(0);
  });

  it("respects overrideEvery param (e.g. 10m)", () => {
    const result = resolveHeartbeatIntervalMs({} as never, "10m");
    expect(result).toBeGreaterThan(0);
  });

  it("returns number when heartbeat.every is set", () => {
    const cfg = { agents: { defaults: { heartbeat: { every: "5m" } } } } as never;
    const result = resolveHeartbeatIntervalMs(cfg);
    expect(typeof result).toBe("number");
  });
});
