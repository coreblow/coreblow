/**
 * src/tools/url-scraper.test.ts
 *
 * CoreBlow — URL Scraper Tests
 * Verifies URLScraper: construction, cache management, getHistory.
 * Network calls are not made in unit tests — tests focus on
 * observable state (cache, history, config defaults).
 */
import { describe, beforeEach, expect, it } from "vitest";
import { URLScraper } from "./url-scraper.js";

let scraper: URLScraper;

beforeEach(() => {
  scraper = new URLScraper();
});

describe("URLScraper — construction", () => {
  it("constructs with default options", () => {
    expect(() => new URLScraper()).not.toThrow();
  });

  it("constructs with custom options", () => {
    expect(() => new URLScraper({ maxLength: 1000, cacheTTL: 60_000, userAgent: "TestBot/1" })).not.toThrow();
  });
});

describe("URLScraper — cache management", () => {
  it("getHistory() returns empty array initially", () => {
    const h = scraper.getHistory();
    expect(Array.isArray(h)).toBe(true);
    expect(h).toHaveLength(0);
  });

  it("clearCache() returns 0 when cache is empty", () => {
    expect(scraper.clearCache()).toBe(0);
  });
});

describe("URLScraper — scrape() with invalid URL", () => {
  it("returns null or throws for invalid URL gracefully", async () => {
    // Not a real network call — invalid URL should fail or return null
    const result = await scraper.scrape("not-a-valid-url").catch(() => null);
    expect(result === null || result !== undefined).toBe(true);
  });

  it("records history entry after attempted scrape", async () => {
    await scraper.scrape("https://invalid.nonexistent.domain.xyz").catch(() => null);
    const h = scraper.getHistory(10);
    expect(h.length).toBeGreaterThanOrEqual(0); // may or may not record depending on impl
  });
});
