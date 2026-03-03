/**
 * extensions/nvidia/provider-catalog.test.ts
 * CoreBlow — Nvidia Extension Provider Catalog Tests
 */
import { describe, expect, it } from "vitest";
import { buildNvidiaProvider } from "./provider-catalog.js";

describe("buildNvidiaProvider", () => {
  it("is a function", () => {
    expect(typeof buildNvidiaProvider).toBe("function");
  });
  it("returns a non-null object", () => {
    const p = buildNvidiaProvider();
    expect(typeof p).toBe("object");
    expect(p).not.toBeNull();
  });
  it("returned object has at least one key", () => {
    const p = buildNvidiaProvider();
    expect(Object.keys(p).length).toBeGreaterThan(0);
  });
  it("does not throw", () => {
    expect(() => buildNvidiaProvider()).not.toThrow();
  });
});
