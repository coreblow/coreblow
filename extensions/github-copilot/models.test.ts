/**
 * extensions/github-copilot/models.test.ts
 *
 * CoreBlow — GitHub Copilot Extension Models Tests
 * Verifies PROVIDER_ID constant and resolveCopilotForwardCompatModel
 * type contract (requires context object, not raw string).
 */
import { describe, expect, it } from "vitest";
import { PROVIDER_ID, resolveCopilotForwardCompatModel } from "./models.js";

describe("GitHub Copilot PROVIDER_ID", () => {
  it("PROVIDER_ID is github-copilot", () => {
    expect(PROVIDER_ID).toBe("github-copilot");
  });

  it("PROVIDER_ID is a non-empty string", () => {
    expect(typeof PROVIDER_ID).toBe("string");
    expect(PROVIDER_ID.length).toBeGreaterThan(0);
  });

  it("PROVIDER_ID contains copilot branding", () => {
    expect(PROVIDER_ID).toContain("copilot");
  });
});

describe("resolveCopilotForwardCompatModel", () => {
  it("is a function", () => {
    expect(typeof resolveCopilotForwardCompatModel).toBe("function");
  });

  it("returns undefined for ctx with empty modelId", () => {
    const ctx = {
      modelId: "",
      modelRegistry: { find: () => undefined },
    };
    const result = resolveCopilotForwardCompatModel(ctx as never);
    expect(result).toBeUndefined();
  });

  it("returns undefined when model is found in registry", () => {
    const ctx = {
      modelId: "gpt-4o",
      modelRegistry: { find: () => ({ id: "gpt-4o" }) },
    };
    const result = resolveCopilotForwardCompatModel(ctx as never);
    expect(result).toBeUndefined();
  });

  it("does not throw for valid ctx shape", () => {
    const ctx = {
      modelId: "gpt-4o",
      modelRegistry: { find: () => undefined },
    };
    expect(() => resolveCopilotForwardCompatModel(ctx as never)).not.toThrow();
  });
});
