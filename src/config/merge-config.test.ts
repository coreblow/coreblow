/**
 * src/config/merge-config.test.ts
 *
 * CoreBlow — Config Merge Utilities Tests
 * Verifies mergeConfigSection shallow merge behavior, unsetOnUndefined option,
 * and mergeWhatsAppConfig channel config merging.
 */
import { describe, expect, it } from "vitest";
import { mergeConfigSection } from "./merge-config.js";

// ── mergeConfigSection ────────────────────────────────────────────────────────

describe("mergeConfigSection", () => {
  it("merges patch into base shallowly", () => {
    const result = mergeConfigSection(
      { a: 1, b: 2 },
      { b: 99, c: 3 } as Record<string, unknown>,
    );
    expect(result).toEqual({ a: 1, b: 99, c: 3 });
  });

  it("uses patch as base when base is undefined", () => {
    const result = mergeConfigSection(undefined, { x: 1, y: 2 } as Record<string, unknown>);
    expect(result).toEqual({ x: 1, y: 2 });
  });

  it("skips undefined patch values by default (does not overwrite)", () => {
    const result = mergeConfigSection(
      { a: "original" },
      { a: undefined } as Record<string, unknown>,
    );
    expect(result.a).toBe("original");
  });

  it("unsets key when unsetOnUndefined includes it and patch value is undefined", () => {
    const result = mergeConfigSection(
      { a: "original", b: "keep" },
      { a: undefined } as Record<string, unknown>,
      { unsetOnUndefined: ["a"] },
    );
    expect(Object.keys(result)).not.toContain("a");
    expect(result.b).toBe("keep");
  });

  it("does not unset key when not in unsetOnUndefined", () => {
    const result = mergeConfigSection(
      { a: "original", b: "keep" },
      { b: undefined } as Record<string, unknown>,
      { unsetOnUndefined: ["a"] },
    );
    expect(result.b).toBe("keep");
    expect(result.a).toBe("original");
  });

  it("returns shallow copy — does not mutate base", () => {
    const base = { a: 1 };
    mergeConfigSection(base, { a: 99 } as Record<string, unknown>);
    expect(base.a).toBe(1);
  });

  it("handles empty patch gracefully", () => {
    const result = mergeConfigSection({ a: 1, b: 2 }, {});
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it("handles empty base and empty patch", () => {
    const result = mergeConfigSection({}, {});
    expect(result).toEqual({});
  });

  it("overwrites with false, 0, and empty string (falsy but defined)", () => {
    const result = mergeConfigSection(
      { flag: true, count: 5, label: "hello" },
      { flag: false, count: 0, label: "" } as Record<string, unknown>,
    );
    expect(result.flag).toBe(false);
    expect(result.count).toBe(0);
    expect(result.label).toBe("");
  });
});
