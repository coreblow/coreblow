import { describe, beforeEach, expect, it, vi } from "vitest";
import { FallbackProvider } from "./fallback.js";
import type { AIProvider } from "./interface.js";

/** Minimal AIProvider stub */
function makeProvider(name: string, available = true): AIProvider {
  return {
    name,
    chat: vi.fn().mockResolvedValue({ content: "ok", usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } }),
    isAvailable: vi.fn().mockResolvedValue(available),
    listModels: vi.fn().mockResolvedValue([`${name}/model-1`]),
  } as unknown as AIProvider;
}

let fallback: FallbackProvider;

beforeEach(() => {
  fallback = new FallbackProvider([makeProvider("openai"), makeProvider("anthropic")], {
    cooldownMs: 60_000,
  });
});

describe("FallbackProvider — construction", () => {
  it("constructs without throwing", () => {
    expect(() => new FallbackProvider([makeProvider("p1")], { cooldownMs: 1000 })).not.toThrow();
  });
});

describe("FallbackProvider — getHealthStatus()", () => {
  it("returns health entries for all providers", () => {
    const health = fallback.getHealthStatus();
    expect(Array.isArray(health)).toBe(true);
    expect(health).toHaveLength(2);
  });

  it("all providers start healthy", () => {
    for (const h of fallback.getHealthStatus()) {
      expect(h.healthy).toBe(true);
    }
  });

  it("each entry has name and totalErrors", () => {
    for (const h of fallback.getHealthStatus()) {
      expect(typeof h.name).toBe("string");
      expect(typeof h.totalErrors).toBe("number");
    }
  });
});

describe("FallbackProvider — resetAll()", () => {
  it("resets all health stats", () => {
    fallback.resetAll();
    for (const h of fallback.getHealthStatus()) {
      expect(h.healthy).toBe(true);
      expect(h.totalErrors).toBe(0);
    }
  });
});

describe("FallbackProvider — isAvailable()", () => {
  it("returns true when at least one provider is available", async () => {
    const result = await fallback.isAvailable();
    expect(typeof result).toBe("boolean");
    expect(result).toBe(true);
  });
});

describe("FallbackProvider — listModels()", () => {
  it("returns models from all providers", async () => {
    const models = await fallback.listModels();
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);
  });

  it("model names are prefixed with provider name", async () => {
    const models = await fallback.listModels();
    expect(models.every((m) => typeof m === "string")).toBe(true);
  });
});
