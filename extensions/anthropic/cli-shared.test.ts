/**
 * extensions/anthropic/cli-shared.test.ts
 *
 * CoreBlow — Anthropic Extension CLI Shared Tests
 * Verifies CLAUDE_CLI_BACKEND_ID and CLAUDE_CLI_MODEL_ALIASES constants.
 */
import { describe, expect, it } from "vitest";
import {
  CLAUDE_CLI_BACKEND_ID,
  CLAUDE_CLI_MODEL_ALIASES,
} from "./cli-shared.js";

describe("Anthropic CLI shared constants", () => {
  it("CLAUDE_CLI_BACKEND_ID is claude-cli", () => {
    expect(CLAUDE_CLI_BACKEND_ID).toBe("claude-cli");
  });

  it("CLAUDE_CLI_BACKEND_ID is a non-empty string", () => {
    expect(typeof CLAUDE_CLI_BACKEND_ID).toBe("string");
    expect(CLAUDE_CLI_BACKEND_ID.length).toBeGreaterThan(0);
  });

  it("CLAUDE_CLI_BACKEND_ID contains claude branding", () => {
    expect(CLAUDE_CLI_BACKEND_ID.toLowerCase()).toContain("claude");
  });

  it("CLAUDE_CLI_MODEL_ALIASES is a non-null object", () => {
    expect(typeof CLAUDE_CLI_MODEL_ALIASES).toBe("object");
    expect(CLAUDE_CLI_MODEL_ALIASES).not.toBeNull();
  });

  it("CLAUDE_CLI_MODEL_ALIASES values are strings", () => {
    for (const [, val] of Object.entries(CLAUDE_CLI_MODEL_ALIASES)) {
      expect(typeof val).toBe("string");
    }
  });

  it("CLAUDE_CLI_MODEL_ALIASES keys are non-empty strings", () => {
    for (const key of Object.keys(CLAUDE_CLI_MODEL_ALIASES)) {
      expect(key.length).toBeGreaterThan(0);
    }
  });
});
