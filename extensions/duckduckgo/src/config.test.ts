/**
 * extensions/duckduckgo/src/config.test.ts
 *
 * CoreBlow — DuckDuckGo Extension Config Tests
 * Verifies DEFAULT_DDG_SAFE_SEARCH constant and config resolver functions.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_DDG_SAFE_SEARCH,
  resolveDdgSafeSearch,
  resolveDdgWebSearchConfig,
} from "./config.js";

describe("DuckDuckGo config constants", () => {
  it("DEFAULT_DDG_SAFE_SEARCH is a non-empty string", () => {
    expect(typeof DEFAULT_DDG_SAFE_SEARCH).toBe("string");
    expect(DEFAULT_DDG_SAFE_SEARCH.length).toBeGreaterThan(0);
  });

  it("DEFAULT_DDG_SAFE_SEARCH is moderate by default", () => {
    expect(DEFAULT_DDG_SAFE_SEARCH).toBe("moderate");
  });
});

describe("resolveDdgSafeSearch", () => {
  it("is a function", () => {
    expect(typeof resolveDdgSafeSearch).toBe("function");
  });

  it("returns a string for undefined config", () => {
    const result = resolveDdgSafeSearch(undefined);
    expect(typeof result).toBe("string");
  });

  it("returns DEFAULT_DDG_SAFE_SEARCH when config is empty", () => {
    const result = resolveDdgSafeSearch({} as never);
    expect(result).toBe(DEFAULT_DDG_SAFE_SEARCH);
  });

  it("does not throw for empty config", () => {
    expect(() => resolveDdgSafeSearch({} as never)).not.toThrow();
  });
});

describe("resolveDdgWebSearchConfig", () => {
  it("is a function", () => {
    expect(typeof resolveDdgWebSearchConfig).toBe("function");
  });

  it("returns undefined or object for empty config", () => {
    const result = resolveDdgWebSearchConfig({} as never);
    expect(result === undefined || typeof result === "object").toBe(true);
  });

  it("does not throw for undefined config", () => {
    expect(() => resolveDdgWebSearchConfig(undefined as never)).not.toThrow();
  });
});
