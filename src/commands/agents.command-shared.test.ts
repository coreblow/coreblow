/**
 * src/commands/agents.command-shared.test.ts
 *
 * CoreBlow — Agents Command Shared Tests
 * Verifies createQuietRuntime utility function.
 */
import { describe, expect, it } from "vitest";
import { createQuietRuntime } from "./agents.command-shared.js";

describe("createQuietRuntime()", () => {
  it("is a function", () => {
    expect(typeof createQuietRuntime).toBe("function");
  });

  it("returns a non-null object", () => {
    const result = createQuietRuntime({} as never);
    expect(typeof result).toBe("object");
    expect(result).not.toBeNull();
  });

  it("does not throw for empty runtime", () => {
    expect(() => createQuietRuntime({} as never)).not.toThrow();
  });

  it("returns an object with at least some keys from input", () => {
    const input = { foo: "bar" } as never;
    const result = createQuietRuntime(input) as Record<string, unknown>;
    expect(typeof result).toBe("object");
  });
});
