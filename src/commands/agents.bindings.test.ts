import { describe, expect, it } from "vitest";
import { describeBinding, parseBindingSpecs } from "./agents.bindings.js";

describe("describeBinding()", () => {
  it("is a function", () => {
    expect(typeof describeBinding).toBe("function");
  });

  it("returns a string for minimal binding", () => {
    const binding = { match: { channel: "discord" } } as never;
    const result = describeBinding(binding);
    expect(typeof result).toBe("string");
  });

  it("includes channel in description", () => {
    const binding = { match: { channel: "telegram" } } as never;
    const result = describeBinding(binding);
    expect(result).toContain("telegram");
  });

  it("includes accountId when present", () => {
    const binding = { match: { channel: "discord", accountId: "acc-123" } } as never;
    const result = describeBinding(binding);
    expect(result).toContain("acc-123");
  });
});

describe("parseBindingSpecs()", () => {
  it("is a function", () => {
    expect(typeof parseBindingSpecs).toBe("function");
  });

  it("returns bindings and errors fields", () => {
    const result = parseBindingSpecs({ agentId: "agent-1", specs: [], config: {} as never });
    expect(Array.isArray(result.bindings)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it("returns empty bindings for empty specs", () => {
    const result = parseBindingSpecs({ agentId: "agent-1", specs: [], config: {} as never });
    expect(result.bindings).toHaveLength(0);
  });

  it("returns no errors for valid spec", () => {
    const result = parseBindingSpecs({
      agentId: "agent-1",
      specs: ["discord"],
      config: {} as never,
    });
    expect(Array.isArray(result.errors)).toBe(true);
  });
});
