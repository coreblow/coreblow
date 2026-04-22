import { describe, expect, it } from "vitest";
import { OPENAI_MODELS, OpenAIProvider } from "./openai.js";

describe("OPENAI_MODELS constants", () => {
  it("is a non-null object", () => {
    expect(typeof OPENAI_MODELS).toBe("object");
    expect(OPENAI_MODELS).not.toBeNull();
  });

  it("has at least one model entry", () => {
    expect(Object.keys(OPENAI_MODELS).length).toBeGreaterThan(0);
  });

  it("all model keys contain gpt or o1 or o3", () => {
    for (const key of Object.keys(OPENAI_MODELS)) {
      expect(/gpt|o1|o3/.test(key)).toBe(true);
    }
  });

  it("each model has contextWindow as positive number", () => {
    for (const [, val] of Object.entries(OPENAI_MODELS)) {
      const model = val as { contextWindow: number };
      expect(typeof model.contextWindow).toBe("number");
      expect(model.contextWindow).toBeGreaterThan(0);
    }
  });

  it("each model has outputTokens as positive number", () => {
    for (const [, val] of Object.entries(OPENAI_MODELS)) {
      const model = val as { outputTokens: number };
      expect(typeof model.outputTokens).toBe("number");
      expect(model.outputTokens).toBeGreaterThan(0);
    }
  });

  it("each model has vision boolean", () => {
    for (const [, val] of Object.entries(OPENAI_MODELS)) {
      const model = val as { vision: boolean };
      expect(typeof model.vision).toBe("boolean");
    }
  });

  it("gpt-4o has vision=true", () => {
    const gpt4o = OPENAI_MODELS["gpt-4o"] as { vision: boolean } | undefined;
    expect(gpt4o?.vision).toBe(true);
  });
});

describe("OpenAIProvider — construction", () => {
  const cfg = { apiKey: "test-key", defaultModel: "gpt-4o" };

  it("constructs without throwing", () => {
    expect(() => new OpenAIProvider(cfg)).not.toThrow();
  });

  it("has id = openai", () => {
    const p = new OpenAIProvider(cfg);
    expect((p as { id?: string }).id).toBe("openai");
  });

  it("has name = OpenAI", () => {
    const p = new OpenAIProvider(cfg);
    expect((p as { name?: string }).name).toBe("OpenAI");
  });

  it("chat is a function", () => {
    const p = new OpenAIProvider(cfg);
    expect(typeof (p as unknown as Record<string, unknown>).chat).toBe("function");
  });
});
