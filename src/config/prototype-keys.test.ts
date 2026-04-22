/**
 * src/config/prototype-keys.test.ts
 *
 * CoreBlow — Prototype Keys Tests
 * Verifies isBlockedObjectKey re-export from infra.
 */
import { describe, expect, it } from "vitest";
import { isBlockedObjectKey } from "./prototype-keys.js";

describe("isBlockedObjectKey()", () => {
  it("is a function", () => {
    expect(typeof isBlockedObjectKey).toBe("function");
  });

  it("returns true for __proto__", () => {
    expect(isBlockedObjectKey("__proto__")).toBe(true);
  });

  it("returns true for constructor", () => {
    expect(isBlockedObjectKey("constructor")).toBe(true);
  });

  it("returns true for prototype", () => {
    expect(isBlockedObjectKey("prototype")).toBe(true);
  });

  it("returns false for ordinary key", () => {
    expect(isBlockedObjectKey("name")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isBlockedObjectKey("")).toBe(false);
  });

  it("returns false for id key", () => {
    expect(isBlockedObjectKey("id")).toBe(false);
  });
});
