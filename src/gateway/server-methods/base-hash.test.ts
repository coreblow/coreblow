import { describe, expect, it } from "vitest";
import { resolveBaseHashParam } from "./base-hash.js";

describe("resolveBaseHashParam()", () => {
  it("returns null for undefined params", () => {
    expect(resolveBaseHashParam(undefined)).toBeNull();
  });

  it("returns null for null params", () => {
    expect(resolveBaseHashParam(null)).toBeNull();
  });

  it("returns null when baseHash is missing", () => {
    expect(resolveBaseHashParam({})).toBeNull();
  });

  it("returns null when baseHash is not a string", () => {
    expect(resolveBaseHashParam({ baseHash: 42 })).toBeNull();
  });

  it("returns null for empty baseHash string", () => {
    expect(resolveBaseHashParam({ baseHash: "   " })).toBeNull();
  });

  it("returns trimmed hash for valid baseHash", () => {
    expect(resolveBaseHashParam({ baseHash: "  abc123  " })).toBe("abc123");
  });

  it("returns hash as-is when no surrounding spaces", () => {
    expect(resolveBaseHashParam({ baseHash: "deadbeef" })).toBe("deadbeef");
  });
});
