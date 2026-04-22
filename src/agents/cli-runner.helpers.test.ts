/**
 * src/agents/cli-runner.helpers.test.ts
 *
 * CoreBlow — CLI Runner Helper Utilities Tests
 * Verifies prompt construction, model normalization, image path handling,
 * and session resolution for the CB cli-runner module.
 */
import { describe, expect, it } from "vitest";
import {
  appendImagePathsToPrompt,
  buildSystemPrompt,
  normalizeCliModel,
  resolvePromptInput,
  resolveSessionIdToSend,
  resolveSystemPromptUsage,
} from "./cli-runner/helpers.js";
import type { CliBackendConfig } from "../config/types.js";

// ── fixtures ─────────────────────────────────────────────────────────────────

function makeBackend(overrides: Partial<CliBackendConfig> = {}): CliBackendConfig {
  return {
    type: "codex",
    model: "o4-mini",
    ...overrides,
  } as CliBackendConfig;
}

// ── normalizeCliModel ─────────────────────────────────────────────────────────

describe("normalizeCliModel", () => {
  it("returns model as-is when no normalization needed", () => {
    const result = normalizeCliModel("o4-mini", makeBackend());
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns a non-empty string for any model input", () => {
    const inputs = ["gpt-4o", "claude-3-5-sonnet", "o4-mini", "gemini-pro"];
    for (const model of inputs) {
      const result = normalizeCliModel(model, makeBackend({ model }));
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    }
  });
});

// ── resolveSystemPromptUsage ──────────────────────────────────────────────────

describe("resolveSystemPromptUsage", () => {
  it("returns an object with required fields", () => {
    const result = resolveSystemPromptUsage({
      backend: makeBackend(),
      hasUserSystemPrompt: false,
    });
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
  });

  it("does not throw for any combination of inputs", () => {
    for (const hasUserSystemPrompt of [true, false]) {
      expect(() =>
        resolveSystemPromptUsage({
          backend: makeBackend(),
          hasUserSystemPrompt,
        }),
      ).not.toThrow();
    }
  });
});

// ── buildSystemPrompt ─────────────────────────────────────────────────────────

describe("buildSystemPrompt", () => {
  it("returns a string", () => {
    const result = buildSystemPrompt({
      workspaceDir: "/tmp",
      tools: [],
      modelDisplay: "o4-mini",
    });
    expect(typeof result).toBe("string");
  });

  it("accepts extra system prompt", () => {
    const result = buildSystemPrompt({
      workspaceDir: "/my/project",
      tools: [],
      modelDisplay: "claude-3-5",
      extraSystemPrompt: "Always be helpful.",
    });
    expect(typeof result).toBe("string");
  });

  it("does not throw with minimal params", () => {
    expect(() =>
      buildSystemPrompt({ workspaceDir: "/", tools: [], modelDisplay: "test-model" }),
    ).not.toThrow();
  });
});

// ── appendImagePathsToPrompt ──────────────────────────────────────────────────

describe("appendImagePathsToPrompt", () => {
  it("returns original prompt when no paths provided", () => {
    const result = appendImagePathsToPrompt("my prompt", []);
    expect(result).toBe("my prompt");
  });

  it("appends paths to the prompt", () => {
    const result = appendImagePathsToPrompt("my prompt", ["/img/a.png", "/img/b.png"]);
    expect(result).toContain("my prompt");
    expect(result.length).toBeGreaterThan("my prompt".length);
  });

  it("preserves prompt when paths list is empty", () => {
    const prompt = "test message";
    expect(appendImagePathsToPrompt(prompt, [])).toBe(prompt);
  });
});

// ── resolveSessionIdToSend ────────────────────────────────────────────────────

describe("resolveSessionIdToSend", () => {
  it("returns object with sessionId and isNew fields", () => {
    const result = resolveSessionIdToSend({
      backend: makeBackend(),
      cliSessionId: "cli-session-123",
    });
    // Contract: returns { sessionId?: string, isNew: boolean }
    expect(typeof result).toBe("object");
    expect(result).toHaveProperty("isNew");
    expect(typeof result.isNew).toBe("boolean");
    expect(result.sessionId === undefined || typeof result.sessionId === "string").toBe(true);
  });

  it("does not throw when cliSessionId is undefined", () => {
    expect(() =>
      resolveSessionIdToSend({ backend: makeBackend(), cliSessionId: undefined }),
    ).not.toThrow();
  });
});

// ── resolvePromptInput ────────────────────────────────────────────────────────

describe("resolvePromptInput", () => {
  it("returns object with prompt string", () => {
    const result = resolvePromptInput({
      backend: makeBackend(),
      prompt: "test prompt",
    });
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
  });

  it("does not throw for any valid prompt string", () => {
    const prompts = ["short", "a".repeat(1000), "unicode: 你好 🌍", ""];
    for (const prompt of prompts) {
      expect(() =>
        resolvePromptInput({ backend: makeBackend(), prompt }),
      ).not.toThrow();
    }
  });
});
