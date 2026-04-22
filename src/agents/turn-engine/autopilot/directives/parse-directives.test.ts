/**
 * src/agents/turn-engine/autopilot/directives/parse-directives.test.ts
 *
 * CoreBlow — AutoPilot parseDirectives Tests
 * Verifies inline directive extraction: model, provider, think, combined.
 */
import { describe, expect, it } from "vitest";
import { parseDirectives } from "./parse-directives.js";

describe("parseDirectives() — no directives", () => {
  it("returns empty directives for plain text", () => {
    const r = parseDirectives("Hello, how can I help?");
    expect(r.directives).toHaveLength(0);
    expect(r.cleanedText).toBe("Hello, how can I help?");
  });

  it("modelOverride is undefined for plain text", () => {
    expect(parseDirectives("no directives").modelOverride).toBeUndefined();
  });
});

describe("parseDirectives() — [model:] directive", () => {
  it("extracts model directive", () => {
    const r = parseDirectives("Use [model:gpt-4o] for this");
    expect(r.modelOverride).toBe("gpt-4o");
  });

  it("removes the directive tag from cleanedText", () => {
    const r = parseDirectives("[model:gpt-4o] hello");
    expect(r.cleanedText).not.toContain("[model:gpt-4o]");
    expect(r.cleanedText).toContain("hello");
  });

  it("pushes a model directive object", () => {
    const r = parseDirectives("[model:claude-3-5-haiku] query");
    expect(r.directives.some((d) => d.type === "model")).toBe(true);
  });

  it("splits provider/model when model contains /", () => {
    const r = parseDirectives("[model:anthropic/claude-3-5-haiku] query");
    expect(r.providerOverride).toBe("anthropic");
    expect(r.modelOverride).toBe("claude-3-5-haiku");
  });
});

describe("parseDirectives() — [provider:] directive", () => {
  it("extracts provider directive", () => {
    const r = parseDirectives("Use [provider:openai] please");
    expect(r.providerOverride).toBe("openai");
  });

  it("removes provider tag from cleanedText", () => {
    const r = parseDirectives("[provider:groq] question");
    expect(r.cleanedText).not.toContain("[provider:groq]");
  });
});

describe("parseDirectives() — [think:] directive", () => {
  it("extracts think level", () => {
    const r = parseDirectives("[think:high] analyze this");
    expect(r.thinkLevel).toBe("high");
  });

  it("removes think tag from cleanedText", () => {
    const r = parseDirectives("[think:low] content");
    expect(r.cleanedText).not.toContain("[think:");
  });
});

describe("parseDirectives() — combined", () => {
  it("handles multiple directives at once", () => {
    const r = parseDirectives("[model:gpt-4o] [think:medium] What is AI?");
    expect(r.modelOverride).toBe("gpt-4o");
    expect(r.thinkLevel).toBe("medium");
    expect(r.cleanedText).toContain("What is AI?");
  });

  it("returns correct directive count", () => {
    const r = parseDirectives("[model:gpt-4o] [provider:openai] [think:high] go");
    expect(r.directives.length).toBeGreaterThanOrEqual(3);
  });
});
