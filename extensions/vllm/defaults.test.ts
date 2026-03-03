/**
 * extensions/vllm/defaults.test.ts
 *
 * CoreBlow — vLLM Extension Defaults Tests
 * Verifies vLLM default base URL (localhost), provider label, and API key env var.
 */
import { describe, expect, it } from "vitest";
import {
  VLLM_DEFAULT_API_KEY_ENV_VAR,
  VLLM_DEFAULT_BASE_URL,
  VLLM_MODEL_PLACEHOLDER,
  VLLM_PROVIDER_LABEL,
} from "./defaults.js";

describe("vLLM default constants", () => {
  it("VLLM_DEFAULT_BASE_URL is a valid localhost URL", () => {
    expect(VLLM_DEFAULT_BASE_URL.startsWith("http://")).toBe(true);
    expect(VLLM_DEFAULT_BASE_URL).toContain("127.0.0.1");
  });

  it("VLLM_DEFAULT_BASE_URL ends with /v1", () => {
    expect(VLLM_DEFAULT_BASE_URL.endsWith("/v1")).toBe(true);
  });

  it("VLLM_PROVIDER_LABEL is a non-empty string", () => {
    expect(typeof VLLM_PROVIDER_LABEL).toBe("string");
    expect(VLLM_PROVIDER_LABEL.length).toBeGreaterThan(0);
  });

  it("VLLM_DEFAULT_API_KEY_ENV_VAR is SCREAMING_SNAKE_CASE", () => {
    expect(/^[A-Z][A-Z0-9_]+$/.test(VLLM_DEFAULT_API_KEY_ENV_VAR)).toBe(true);
  });

  it("VLLM_MODEL_PLACEHOLDER is a non-empty string", () => {
    expect(typeof VLLM_MODEL_PLACEHOLDER).toBe("string");
    expect(VLLM_MODEL_PLACEHOLDER.length).toBeGreaterThan(0);
  });

  it("VLLM_MODEL_PLACEHOLDER contains a / (org/model format)", () => {
    expect(VLLM_MODEL_PLACEHOLDER).toContain("/");
  });
});
