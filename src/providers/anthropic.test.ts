import { describe, expect, it } from "vitest";
import { ANTHROPIC_MODELS, AnthropicProvider } from "./anthropic.js";

describe("ANTHROPIC_MODELS constants", () => {
  it("is a non-null object", () => {
    expect(typeof ANTHROPIC_MODELS).toBe("object");
    expect(ANTHROPIC_MODELS).not.toBeNull();
  });

  it("has at least one model entry", () => {
    expect(Object.keys(ANTHROPIC_MODELS).length).toBeGreaterThan(0);
  });

  it("each model has contextWindow as positive number", () => {
    for (const [, val] of Object.entries(ANTHROPIC_MODELS)) {
      const m = val as { contextWindow: number };
      expect(typeof m.contextWindow).toBe("number");
      expect(m.contextWindow).toBeGreaterThan(0);
    }
  });

  it("each model has outputTokens as positive number", () => {
    for (const [, val] of Object.entries(ANTHROPIC_MODELS)) {
      const m = val as { outputTokens: number };
      expect(typeof m.outputTokens).toBe("number");
      expect(m.outputTokens).toBeGreaterThan(0);
    }
  });

  it("contains claude model keys", () => {
    const keys = Object.keys(ANTHROPIC_MODELS);
    expect(keys.some((k) => k.toLowerCase().includes("claude"))).toBe(true);
  });
});

describe("AnthropicProvider — construction", () => {
  const cfg = { apiKey: "test-key" };

  it("constructs without throwing", () => {
    expect(() => new AnthropicProvider(cfg)).not.toThrow();
  });

  it("has id = anthropic", () => {
    const p = new AnthropicProvider(cfg);
    expect((p as { id?: string }).id).toBe("anthropic");
  });

  it("has name = Anthropic", () => {
    const p = new AnthropicProvider(cfg);
    expect((p as { name?: string }).name).toBe("Anthropic");
  });

  it("chat is a function", () => {
    const p = new AnthropicProvider(cfg);
    expect(typeof (p as unknown as Record<string, unknown>).chat).toBe("function");
  });
});
