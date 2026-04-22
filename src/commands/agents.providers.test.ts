/**
 * src/commands/agents.providers.test.ts
 *
 * CoreBlow — Agents Providers Tests
 * Verifies summarizeBindings and listProvidersForAgent.
 */
import { describe, expect, it } from "vitest";
import { summarizeBindings, listProvidersForAgent } from "./agents.providers.js";

describe("summarizeBindings()", () => {
  it("is a function", () => {
    expect(typeof summarizeBindings).toBe("function");
  });

  it("returns empty array for empty bindings", () => {
    const result = summarizeBindings({} as never, []);
    expect(result).toEqual([]);
  });

  it("returns an array", () => {
    const binding = { match: { channel: "discord" } };
    const result = summarizeBindings({} as never, [binding] as never);
    expect(Array.isArray(result)).toBe(true);
  });

  it("result elements are strings", () => {
    const binding = { match: { channel: "telegram" } };
    const result = summarizeBindings({} as never, [binding] as never);
    for (const item of result) {
      expect(typeof item).toBe("string");
    }
  });
});

describe("listProvidersForAgent()", () => {
  it("is a function", () => {
    expect(typeof listProvidersForAgent).toBe("function");
  });

  it("returns an array for empty bindings/providerStatus", () => {
    const result = listProvidersForAgent({
      summaryIsDefault: true,
      cfg: {} as never,
      bindings: [],
      providerStatus: new Map(),
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it("result elements are strings when providers exist", () => {
    const result = listProvidersForAgent({
      summaryIsDefault: false,
      cfg: {} as never,
      bindings: [],
      providerStatus: new Map([
        ["openai", { providerId: "openai", status: "ok", models: [] } as never],
      ]),
    });
    for (const item of result) {
      expect(typeof item).toBe("string");
    }
  });
});
