import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { createScopedExpiringIdCache } from "./scoped-expiring-id-cache.js";

describe("createScopedExpiringIdCache", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  function makeCache(ttlMs = 1000) {
    return createScopedExpiringIdCache<string, string>({
      store: new Map(),
      ttlMs,
      cleanupThreshold: 100,
    });
  }

  it("returns false for unseen ids", () => {
    const cache = makeCache();
    expect(cache.has("scope", "id1")).toBe(false);
  });

  it("returns true for recently added ids", () => {
    const cache = makeCache();
    cache.record("scope", "id1");
    expect(cache.has("scope", "id1")).toBe(true);
  });

  it("expires ids after TTL", () => {
    const cache = makeCache(500);
    cache.record("scope", "id1");
    vi.advanceTimersByTime(600);
    expect(cache.has("scope", "id1")).toBe(false);
  });

  it("isolates scopes", () => {
    const cache = makeCache();
    cache.record("scope-a", "id1");
    expect(cache.has("scope-a", "id1")).toBe(true);
    expect(cache.has("scope-b", "id1")).toBe(false);
  });
});
