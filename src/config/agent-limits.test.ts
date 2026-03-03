import { describe, it, expect } from "vitest";
import {
  resolveAgentMaxConcurrent,
  resolveSubagentMaxConcurrent,
  DEFAULT_AGENT_MAX_CONCURRENT,
  DEFAULT_SUBAGENT_MAX_CONCURRENT,
  DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH,
} from "./agent-limits.js";

describe("resolveAgentMaxConcurrent", () => {
  it("returns default when no config", () => {
    expect(resolveAgentMaxConcurrent()).toBe(DEFAULT_AGENT_MAX_CONCURRENT);
    expect(resolveAgentMaxConcurrent(undefined)).toBe(DEFAULT_AGENT_MAX_CONCURRENT);
    expect(resolveAgentMaxConcurrent({} as any)).toBe(DEFAULT_AGENT_MAX_CONCURRENT);
  });

  it("returns configured value", () => {
    expect(resolveAgentMaxConcurrent({ agents: { defaults: { maxConcurrent: 10 } } } as any)).toBe(10);
  });

  it("clamps to minimum of 1", () => {
    expect(resolveAgentMaxConcurrent({ agents: { defaults: { maxConcurrent: 0 } } } as any)).toBe(1);
    expect(resolveAgentMaxConcurrent({ agents: { defaults: { maxConcurrent: -5 } } } as any)).toBe(1);
  });

  it("floors fractional values", () => {
    expect(resolveAgentMaxConcurrent({ agents: { defaults: { maxConcurrent: 3.9 } } } as any)).toBe(3);
  });

  it("ignores non-number values", () => {
    expect(resolveAgentMaxConcurrent({ agents: { defaults: { maxConcurrent: "5" } } } as any)).toBe(DEFAULT_AGENT_MAX_CONCURRENT);
    expect(resolveAgentMaxConcurrent({ agents: { defaults: { maxConcurrent: NaN } } } as any)).toBe(DEFAULT_AGENT_MAX_CONCURRENT);
    expect(resolveAgentMaxConcurrent({ agents: { defaults: { maxConcurrent: Infinity } } } as any)).toBe(DEFAULT_AGENT_MAX_CONCURRENT);
  });
});

describe("resolveSubagentMaxConcurrent", () => {
  it("returns default when no config", () => {
    expect(resolveSubagentMaxConcurrent()).toBe(DEFAULT_SUBAGENT_MAX_CONCURRENT);
    expect(resolveSubagentMaxConcurrent({} as any)).toBe(DEFAULT_SUBAGENT_MAX_CONCURRENT);
  });

  it("returns configured value", () => {
    expect(
      resolveSubagentMaxConcurrent({
        agents: { defaults: { subagents: { maxConcurrent: 16 } } },
      } as any),
    ).toBe(16);
  });

  it("clamps to minimum of 1", () => {
    expect(
      resolveSubagentMaxConcurrent({
        agents: { defaults: { subagents: { maxConcurrent: 0 } } },
      } as any),
    ).toBe(1);
  });
});

describe("constants", () => {
  it("has expected default values", () => {
    expect(DEFAULT_AGENT_MAX_CONCURRENT).toBe(4);
    expect(DEFAULT_SUBAGENT_MAX_CONCURRENT).toBe(8);
    expect(DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH).toBe(1);
  });
});
