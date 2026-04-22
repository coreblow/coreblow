/**
 * src/cron/isolated-agent/run-config.test.ts
 *
 * CoreBlow — Cron Isolated Agent Run Config Tests
 * Verifies buildCronAgentDefaultsConfig merges defaults with
 * agent overrides correctly, excluding sandbox from defaults.
 */
import { describe, expect, it } from "vitest";
import { buildCronAgentDefaultsConfig } from "./run-config.js";
import type { AgentDefaultsConfig } from "../../config/types.js";

function makeDefaults(overrides: Partial<AgentDefaultsConfig> = {}): AgentDefaultsConfig {
  return {
    model: { primary: "gpt-4o" },
    ...overrides,
  } as AgentDefaultsConfig;
}

describe("buildCronAgentDefaultsConfig", () => {
  it("returns object with defaults when no override provided", () => {
    const result = buildCronAgentDefaultsConfig({ defaults: makeDefaults() });
    expect(typeof result).toBe("object");
    expect(result).not.toBeNull();
  });

  it("preserves defaults.model when no agentConfigOverride", () => {
    const result = buildCronAgentDefaultsConfig({
      defaults: makeDefaults({ model: { primary: "gpt-4o" } } as never),
    });
    expect((result.model as never as { primary: string })?.primary).toBe("gpt-4o");
  });

  it("merges string model override into model.primary", () => {
    const result = buildCronAgentDefaultsConfig({
      defaults: makeDefaults(),
      agentConfigOverride: { model: "claude-3-opus" } as never,
    });
    expect((result.model as never as { primary: string })?.primary).toBe("claude-3-opus");
  });

  it("merges object model override", () => {
    const result = buildCronAgentDefaultsConfig({
      defaults: makeDefaults({ model: { primary: "gpt-4o" } } as never),
      agentConfigOverride: {
        model: { primary: "gemini-pro", fallbacks: ["gpt-4"] },
      } as never,
    });
    const model = result.model as never as { primary: string; fallbacks: string[] };
    expect(model.primary).toBe("gemini-pro");
    expect(model.fallbacks).toEqual(["gpt-4"]);
  });

  it("does not throw when defaults is undefined", () => {
    expect(() => buildCronAgentDefaultsConfig({})).not.toThrow();
  });

  it("does not throw when agentConfigOverride is undefined", () => {
    expect(() =>
      buildCronAgentDefaultsConfig({ defaults: makeDefaults() }),
    ).not.toThrow();
  });

  it("excludes sandbox from merged defaults", () => {
    const result = buildCronAgentDefaultsConfig({
      defaults: makeDefaults(),
      agentConfigOverride: { sandbox: { enabled: true }, model: "gpt-4o" } as never,
    });
    // sandbox should NOT be copied into defaults
    expect((result as never as Record<string, unknown>).sandbox).toBeUndefined();
  });
});
