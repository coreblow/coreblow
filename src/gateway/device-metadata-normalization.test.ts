import { describe, it, expect } from "vitest";
import {
  normalizeDeviceMetadataForAuth,
  normalizeDeviceMetadataForPolicy,
} from "./device-metadata-normalization.js";

describe("normalizeDeviceMetadataForAuth", () => {
  it("lowercases ASCII characters", () => {
    expect(normalizeDeviceMetadataForAuth("iOS")).toBe("ios");
    expect(normalizeDeviceMetadataForAuth("Android")).toBe("android");
    expect(normalizeDeviceMetadataForAuth("MacOS")).toBe("macos");
  });

  it("trims whitespace", () => {
    expect(normalizeDeviceMetadataForAuth("  iOS  ")).toBe("ios");
  });

  it("returns empty string for null/undefined/empty", () => {
    expect(normalizeDeviceMetadataForAuth(null)).toBe("");
    expect(normalizeDeviceMetadataForAuth(undefined)).toBe("");
    expect(normalizeDeviceMetadataForAuth("")).toBe("");
    expect(normalizeDeviceMetadataForAuth("   ")).toBe("");
  });

  it("handles non-string values", () => {
    expect(normalizeDeviceMetadataForAuth(42 as any)).toBe("");
  });
});

describe("normalizeDeviceMetadataForPolicy", () => {
  it("normalizes to lowercase with NFKD decomposition", () => {
    expect(normalizeDeviceMetadataForPolicy("iOS")).toBe("ios");
    expect(normalizeDeviceMetadataForPolicy("ANDROID")).toBe("android");
    expect(normalizeDeviceMetadataForPolicy("Linux")).toBe("linux");
  });

  it("trims whitespace", () => {
    expect(normalizeDeviceMetadataForPolicy("  Windows  ")).toBe("windows");
  });

  it("returns empty string for null/undefined/empty", () => {
    expect(normalizeDeviceMetadataForPolicy(null)).toBe("");
    expect(normalizeDeviceMetadataForPolicy(undefined)).toBe("");
    expect(normalizeDeviceMetadataForPolicy("")).toBe("");
  });

  it("strips combining marks via NFKD normalization", () => {
    // é (U+00E9) decomposes to e + combining acute
    const result = normalizeDeviceMetadataForPolicy("café");
    expect(result).toBe("cafe");
  });
});
