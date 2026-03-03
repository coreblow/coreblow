import { describe, it, expect } from "vitest";
import { resolveAllowedAgentIds } from "./hooks-policy.js";

describe("resolveAllowedAgentIds", () => {
  it("returns undefined for non-array input", () => {
    expect(resolveAllowedAgentIds(undefined)).toBeUndefined();
    expect(resolveAllowedAgentIds(null as any)).toBeUndefined();
  });

  it("returns a Set of normalized agent IDs", () => {
    const result = resolveAllowedAgentIds(["agent-1", "Agent-2"]);
    expect(result).toBeInstanceOf(Set);
    expect(result!.size).toBe(2);
  });

  it("skips empty/whitespace-only entries", () => {
    const result = resolveAllowedAgentIds(["agent-1", "", "  ", "agent-2"]);
    expect(result!.size).toBe(2);
  });

  it("returns undefined when wildcard * is present", () => {
    const result = resolveAllowedAgentIds(["agent-1", "*", "agent-2"]);
    expect(result).toBeUndefined();
  });

  it("wildcard with whitespace is treated as wildcard", () => {
    const result = resolveAllowedAgentIds(["  *  "]);
    expect(result).toBeUndefined();
  });

  it("returns empty set for array of empty strings", () => {
    const result = resolveAllowedAgentIds(["", "  "]);
    expect(result).toBeInstanceOf(Set);
    expect(result!.size).toBe(0);
  });
});
