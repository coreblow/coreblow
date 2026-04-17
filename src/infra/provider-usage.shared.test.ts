import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIMEOUT_MS,
  PROVIDER_LABELS,
  usageProviders,
  resolveUsageProviderId,
  ignoredErrors,
} from "./provider-usage.shared.js";

describe("provider-usage.shared", () => {
  it("exports a default timeout in milliseconds", () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(5000);
  });

  it("exports a non-empty list of usage providers", () => {
    expect(usageProviders.length).toBeGreaterThan(0);
    for (const id of usageProviders) {
      expect(typeof id).toBe("string");
    }
  });

  it("maps every usage provider to a label", () => {
    for (const id of usageProviders) {
      expect(PROVIDER_LABELS[id]).toBeDefined();
      expect(typeof PROVIDER_LABELS[id]).toBe("string");
    }
  });

  it("resolves known provider strings to usage provider ids", () => {
    const first = usageProviders[0];
    expect(resolveUsageProviderId(first)).toBe(first);
  });

  it("returns undefined for unknown providers", () => {
    expect(resolveUsageProviderId("totally-unknown-xyz")).toBeUndefined();
    expect(resolveUsageProviderId(null)).toBeUndefined();
    expect(resolveUsageProviderId(undefined)).toBeUndefined();
  });

  it("exports a set of ignored error patterns", () => {
    expect(ignoredErrors).toBeDefined();
    expect(ignoredErrors.size).toBeGreaterThan(0);
  });
});
