/**
 * extensions/browser/src/browser/cdp.helpers.test.ts
 *
 * CoreBlow — Browser Extension: Cdp Helpers Tests
 * Verifies CDP helper utilities and connection handling.
 */
import { describe, expect, it } from "vitest";
import {
  appendCdpPath,
  isWebSocketUrl,
  normalizeCdpHttpBaseForJsonEndpoints,
  redactCdpUrl,
} from "./cdp.helpers.js";

describe("isWebSocketUrl", () => {
  it("returns true for ws: URLs", () => {
    expect(isWebSocketUrl("ws://localhost:9222")).toBe(true);
    expect(isWebSocketUrl("ws://example.com/devtools")).toBe(true);
  });

  it("returns true for wss: URLs", () => {
    expect(isWebSocketUrl("wss://secure.example.com")).toBe(true);
  });

  it("returns false for http: URLs", () => {
    expect(isWebSocketUrl("http://localhost:9222")).toBe(false);
    expect(isWebSocketUrl("https://example.com")).toBe(false);
  });

  it("returns false for invalid URLs", () => {
    expect(isWebSocketUrl("not-a-url")).toBe(false);
    expect(isWebSocketUrl("")).toBe(false);
  });
});

describe("appendCdpPath", () => {
  it("appends path to CDP URL", () => {
    expect(appendCdpPath("http://localhost:9222", "/json/version")).toBe(
      "http://localhost:9222/json/version",
    );
  });

  it("appends to URL with existing path", () => {
    expect(appendCdpPath("http://localhost:9222/base", "/json")).toBe(
      "http://localhost:9222/base/json",
    );
  });
});

describe("normalizeCdpHttpBaseForJsonEndpoints", () => {
  it("converts ws: to http:", () => {
    const result = normalizeCdpHttpBaseForJsonEndpoints("ws://localhost:9222");
    expect(result).toContain("http://");
    expect(result).toContain("localhost:9222");
  });

  it("converts wss: to https:", () => {
    const result = normalizeCdpHttpBaseForJsonEndpoints("wss://secure.example.com");
    expect(result).toContain("https://");
  });

  it("keeps http: unchanged", () => {
    const result = normalizeCdpHttpBaseForJsonEndpoints("http://localhost:9222");
    expect(result).toContain("http://");
    expect(result).not.toContain("https://");
  });
});

describe("redactCdpUrl", () => {
  it("returns null for null input", () => {
    expect(redactCdpUrl(null)).toBeNull();
  });

  it("returns undefined for undefined input", () => {
    expect(redactCdpUrl(undefined)).toBeUndefined();
  });

  it("returns empty string for empty input", () => {
    expect(redactCdpUrl("")).toBe("");
  });

  it("strips username and password from URL", () => {
    const result = redactCdpUrl("http://user:secret@localhost:9222");
    expect(result).not.toContain("user");
    expect(result).not.toContain("secret");
    expect(result).toContain("localhost:9222");
  });

  it("passes through URLs without credentials unchanged", () => {
    const result = redactCdpUrl("http://localhost:9222");
    expect(result).toContain("localhost:9222");
  });
});
