import { describe, it, expect, beforeEach } from "vitest";
import {
  resolveNormalizedProviderModelMaxTokens,
  applyMessageDefaults,
  applySessionDefaults,
  applyAgentDefaults,
  applyLoggingDefaults,
  applyCompactionDefaults,
  resetSessionDefaultsWarningForTests,
} from "./defaults.js";

describe("resolveNormalizedProviderModelMaxTokens", () => {
  it("clamps maxTokens to contextWindow", () => {
    const result = resolveNormalizedProviderModelMaxTokens({
      providerId: "openai",
      modelId: "gpt-5",
      contextWindow: 4096,
      rawMaxTokens: 8192,
    });
    expect(result).toBe(4096);
  });

  it("returns rawMaxTokens when under contextWindow", () => {
    const result = resolveNormalizedProviderModelMaxTokens({
      providerId: "openai",
      modelId: "gpt-5",
      contextWindow: 128000,
      rawMaxTokens: 8192,
    });
    expect(result).toBe(8192);
  });

  it("applies Mistral safe limit for known models at context boundary", () => {
    const result = resolveNormalizedProviderModelMaxTokens({
      providerId: "mistral",
      modelId: "mistral-large-latest",
      contextWindow: 32768,
      rawMaxTokens: 32768, // equals context window → triggers Mistral safety
    });
    expect(result).toBe(16384); // MISTRAL_SAFE_MAX_TOKENS_BY_MODEL limit
  });

  it("uses default safe limit for unknown Mistral models at boundary", () => {
    const result = resolveNormalizedProviderModelMaxTokens({
      providerId: "mistral",
      modelId: "mistral-unknown-model",
      contextWindow: 32768,
      rawMaxTokens: 32768,
    });
    expect(result).toBe(8192); // DEFAULT_MODEL_MAX_TOKENS fallback
  });

  it("does not apply Mistral limits for non-Mistral providers", () => {
    const result = resolveNormalizedProviderModelMaxTokens({
      providerId: "anthropic",
      modelId: "claude-sonnet-4-6",
      contextWindow: 200000,
      rawMaxTokens: 200000,
    });
    expect(result).toBe(200000);
  });
});

describe("applyMessageDefaults", () => {
  it("sets default ackReactionScope when not configured", () => {
    const cfg = {} as any;
    const result = applyMessageDefaults(cfg);
    expect(result.messages?.ackReactionScope).toBe("group-mentions");
  });

  it("preserves existing ackReactionScope", () => {
    const cfg = { messages: { ackReactionScope: "all" } } as any;
    const result = applyMessageDefaults(cfg);
    expect(result.messages?.ackReactionScope).toBe("all");
  });
});

describe("applySessionDefaults", () => {
  beforeEach(() => resetSessionDefaultsWarningForTests());

  it("returns config unchanged when no session.mainKey", () => {
    const cfg = {} as any;
    expect(applySessionDefaults(cfg)).toBe(cfg);
  });

  it("normalizes session.mainKey to 'main'", () => {
    const cfg = { session: { mainKey: "custom" } } as any;
    const warnings: string[] = [];
    const result = applySessionDefaults(cfg, { warn: (m) => warnings.push(m) });
    expect(result.session?.mainKey).toBe("main");
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain("ignored");
  });

  it("warns only once per warn state", () => {
    const warnState = { warned: false };
    const warnings: string[] = [];
    const opts = { warn: (m: string) => warnings.push(m), warnState };

    applySessionDefaults({ session: { mainKey: "a" } } as any, opts);
    applySessionDefaults({ session: { mainKey: "b" } } as any, opts);
    expect(warnings).toHaveLength(1);
  });
});

describe("applyAgentDefaults", () => {
  it("returns config unchanged when defaults already set", () => {
    const cfg = {
      agents: {
        defaults: {
          maxConcurrent: 5,
          subagents: { maxConcurrent: 3 },
        },
      },
    } as any;
    expect(applyAgentDefaults(cfg)).toBe(cfg);
  });

  it("sets maxConcurrent and subagents.maxConcurrent defaults", () => {
    const cfg = {} as any;
    const result = applyAgentDefaults(cfg);
    expect(result.agents?.defaults?.maxConcurrent).toBeDefined();
    expect(result.agents?.defaults?.subagents?.maxConcurrent).toBeDefined();
  });
});

describe("applyLoggingDefaults", () => {
  it("returns config unchanged when no logging section", () => {
    const cfg = {} as any;
    expect(applyLoggingDefaults(cfg)).toBe(cfg);
  });

  it("sets redactSensitive to 'tools' when not configured", () => {
    const cfg = { logging: { level: "info" } } as any;
    const result = applyLoggingDefaults(cfg);
    expect(result.logging?.redactSensitive).toBe("tools");
  });

  it("preserves existing redactSensitive", () => {
    const cfg = { logging: { redactSensitive: "all" } } as any;
    expect(applyLoggingDefaults(cfg)).toBe(cfg);
  });
});

describe("applyCompactionDefaults", () => {
  it("returns config unchanged when no agents.defaults", () => {
    const cfg = {} as any;
    expect(applyCompactionDefaults(cfg)).toBe(cfg);
  });

  it("sets compaction.mode = 'safeguard' when not configured", () => {
    const cfg = { agents: { defaults: {} } } as any;
    const result = applyCompactionDefaults(cfg);
    expect(result.agents?.defaults?.compaction?.mode).toBe("safeguard");
  });

  it("preserves existing compaction.mode", () => {
    const cfg = { agents: { defaults: { compaction: { mode: "manual" } } } } as any;
    expect(applyCompactionDefaults(cfg)).toBe(cfg);
  });
});
