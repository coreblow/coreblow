/**
 * extensions/sglang/defaults.test.ts
 *
 * CoreBlow — SGLang Extension Defaults Tests
 * Verifies SGLang default base URL (localhost), provider label, and API key env var.
 */
import { describe, expect, it } from "vitest";
import {
  SGLANG_DEFAULT_API_KEY_ENV_VAR,
  SGLANG_DEFAULT_BASE_URL,
  SGLANG_MODEL_PLACEHOLDER,
  SGLANG_PROVIDER_LABEL,
} from "./defaults.js";

describe("SGLang default constants", () => {
  it("SGLANG_DEFAULT_BASE_URL is a valid localhost URL", () => {
    expect(SGLANG_DEFAULT_BASE_URL.startsWith("http://")).toBe(true);
    expect(SGLANG_DEFAULT_BASE_URL).toContain("127.0.0.1");
  });

  it("SGLANG_DEFAULT_BASE_URL ends with /v1", () => {
    expect(SGLANG_DEFAULT_BASE_URL.endsWith("/v1")).toBe(true);
  });

  it("SGLANG_PROVIDER_LABEL is a non-empty string", () => {
    expect(typeof SGLANG_PROVIDER_LABEL).toBe("string");
    expect(SGLANG_PROVIDER_LABEL.length).toBeGreaterThan(0);
  });

  it("SGLANG_DEFAULT_API_KEY_ENV_VAR is SCREAMING_SNAKE_CASE", () => {
    expect(/^[A-Z][A-Z0-9_]+$/.test(SGLANG_DEFAULT_API_KEY_ENV_VAR)).toBe(true);
  });

  it("SGLANG_MODEL_PLACEHOLDER is a non-empty string", () => {
    expect(typeof SGLANG_MODEL_PLACEHOLDER).toBe("string");
    expect(SGLANG_MODEL_PLACEHOLDER.length).toBeGreaterThan(0);
  });

  it("SGLANG_MODEL_PLACEHOLDER contains / (org/model format)", () => {
    expect(SGLANG_MODEL_PLACEHOLDER).toContain("/");
  });
});
