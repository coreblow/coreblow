/**
 * extensions/browser/src/browser/url-pattern.test.ts
 *
 * CoreBlow — Browser Extension: Url-pattern Tests
 * Verifies URL pattern matching and normalization.
 */
import { describe, expect, it } from "vitest";
import { matchBrowserUrlPattern } from "./url-pattern.js";

describe("matchBrowserUrlPattern", () => {
  it("matches exact URLs", () => {
    expect(matchBrowserUrlPattern("https://example.com/a", "https://example.com/a")).toBe(true);
    expect(matchBrowserUrlPattern("https://example.com/a", "https://example.com/b")).toBe(false);
  });

  it("matches substring patterns without wildcards", () => {
    expect(matchBrowserUrlPattern("example.com", "https://example.com/a")).toBe(true);
    expect(matchBrowserUrlPattern("/dash", "https://example.com/app/dash")).toBe(true);
    expect(matchBrowserUrlPattern("nope", "https://example.com/a")).toBe(false);
  });

  it("matches single-star glob patterns", () => {
    expect(matchBrowserUrlPattern("https://example.com/*", "https://example.com/a")).toBe(true);
    expect(matchBrowserUrlPattern("https://example.com/*", "https://other.com/a")).toBe(false);
  });

  it("matches double-star glob patterns", () => {
    expect(matchBrowserUrlPattern("**/dash", "https://example.com/app/dash")).toBe(true);
    expect(matchBrowserUrlPattern("**/dash", "https://other.org/x/y/dash")).toBe(true);
    expect(matchBrowserUrlPattern("**/dash", "https://example.com/app/other")).toBe(false);
  });

  it("rejects empty patterns", () => {
    expect(matchBrowserUrlPattern("", "https://example.com")).toBe(false);
    expect(matchBrowserUrlPattern("   ", "https://example.com")).toBe(false);
  });

  it("handles protocol-specific patterns", () => {
    expect(matchBrowserUrlPattern("https://", "https://example.com")).toBe(true);
    expect(matchBrowserUrlPattern("https://", "http://example.com")).toBe(false);
  });
});
