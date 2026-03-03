/**
 * extensions/xai/model-id.test.ts
 *
 * CoreBlow — xAI Extension Model ID Normalization Tests
 * Verifies normalizeXaiModelId aliases deprecated model IDs
 * to their canonical replacements.
 */
import { describe, expect, it } from "vitest";
import { normalizeXaiModelId } from "./model-id.js";

describe("normalizeXaiModelId", () => {
  it("normalizes grok-4-fast-reasoning to grok-4-fast", () => {
    expect(normalizeXaiModelId("grok-4-fast-reasoning")).toBe("grok-4-fast");
  });

  it("normalizes grok-4-1-fast-reasoning to grok-4-1-fast", () => {
    expect(normalizeXaiModelId("grok-4-1-fast-reasoning")).toBe("grok-4-1-fast");
  });

  it("normalizes grok-4.20-experimental-beta-0304-reasoning to canonical", () => {
    expect(normalizeXaiModelId("grok-4.20-experimental-beta-0304-reasoning")).toBe(
      "grok-4.20-beta-latest-reasoning",
    );
  });

  it("normalizes grok-4.20-experimental-beta-0304-non-reasoning to canonical", () => {
    expect(normalizeXaiModelId("grok-4.20-experimental-beta-0304-non-reasoning")).toBe(
      "grok-4.20-beta-latest-non-reasoning",
    );
  });

  it("normalizes grok-4.20-reasoning to beta-latest", () => {
    expect(normalizeXaiModelId("grok-4.20-reasoning")).toBe(
      "grok-4.20-beta-latest-reasoning",
    );
  });

  it("returns unknown model id unchanged", () => {
    expect(normalizeXaiModelId("grok-4")).toBe("grok-4");
  });

  it("returns empty string unchanged", () => {
    expect(normalizeXaiModelId("")).toBe("");
  });

  it("returns non-aliased model id unchanged", () => {
    expect(normalizeXaiModelId("grok-vision-beta")).toBe("grok-vision-beta");
  });

  it("return type is always a string", () => {
    expect(typeof normalizeXaiModelId("any-model")).toBe("string");
  });
});
