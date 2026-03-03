/**
 * extensions/huggingface/models.test.ts
 *
 * CoreBlow — HuggingFace Extension Models Tests
 * Verifies HuggingFace base URL, policy suffixes, and
 * isHuggingfacePolicyLocked behavior.
 */
import { describe, expect, it } from "vitest";
import {
  HUGGINGFACE_BASE_URL,
  HUGGINGFACE_MODEL_CATALOG,
  HUGGINGFACE_POLICY_SUFFIXES,
  isHuggingfacePolicyLocked,
} from "./models.js";

describe("HuggingFace model constants", () => {
  it("HUGGINGFACE_BASE_URL is a valid HTTPS URL", () => {
    expect(HUGGINGFACE_BASE_URL.startsWith("https://")).toBe(true);
  });

  it("HUGGINGFACE_BASE_URL contains huggingface.co", () => {
    expect(HUGGINGFACE_BASE_URL).toContain("huggingface.co");
  });

  it("HUGGINGFACE_BASE_URL ends with /v1", () => {
    expect(HUGGINGFACE_BASE_URL.endsWith("/v1")).toBe(true);
  });

  it("HUGGINGFACE_POLICY_SUFFIXES contains cheapest", () => {
    expect(HUGGINGFACE_POLICY_SUFFIXES).toContain("cheapest");
  });

  it("HUGGINGFACE_POLICY_SUFFIXES contains fastest", () => {
    expect(HUGGINGFACE_POLICY_SUFFIXES).toContain("fastest");
  });

  it("HUGGINGFACE_MODEL_CATALOG is an array", () => {
    expect(Array.isArray(HUGGINGFACE_MODEL_CATALOG)).toBe(true);
  });
});

describe("isHuggingfacePolicyLocked", () => {
  it("returns a boolean", () => {
    expect(typeof isHuggingfacePolicyLocked("some-model")).toBe("boolean");
  });

  it("returns false for model without policy suffix", () => {
    expect(isHuggingfacePolicyLocked("meta-llama/Llama-3.3-70B-Instruct")).toBe(false);
  });

  it("returns true for model with :cheapest suffix", () => {
    expect(isHuggingfacePolicyLocked("meta-llama/Llama-3.3-70B-Instruct:cheapest")).toBe(true);
  });

  it("returns true for model with :fastest suffix", () => {
    expect(isHuggingfacePolicyLocked("meta-llama/Llama-3.3-70B-Instruct:fastest")).toBe(true);
  });

  it("does not throw for empty string", () => {
    expect(() => isHuggingfacePolicyLocked("")).not.toThrow();
  });
});
