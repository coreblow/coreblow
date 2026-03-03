import { describe, expect, it } from "vitest";
import {
  sanitizeToolResult,
  isToolResultError,
  extractToolErrorMessage,
  isToolResultMediaTrusted,
  extractToolResultMediaPaths,
} from "./pi-embedded-subscribe.tools.js";

describe("sanitizeToolResult", () => {
  it("passes through string results", () => {
    expect(sanitizeToolResult("hello")).toBe("hello");
  });

  it("passes through non-object values", () => {
    expect(sanitizeToolResult(42)).toBe(42);
    expect(sanitizeToolResult(null)).toBeNull();
  });
});

describe("isToolResultError", () => {
  it("returns false for non-error results", () => {
    expect(isToolResultError("ok")).toBe(false);
    expect(isToolResultError(null)).toBe(false);
    expect(isToolResultError({ content: [] })).toBe(false);
  });

  it("returns false for non-error results", () => {
    expect(isToolResultError("ok")).toBe(false);
    expect(isToolResultError(null)).toBe(false);
    expect(isToolResultError({ isError: false })).toBe(false);
  });
});

describe("extractToolErrorMessage", () => {
  it("returns undefined for non-error values", () => {
    expect(extractToolErrorMessage("ok")).toBeUndefined();
    expect(extractToolErrorMessage(null)).toBeUndefined();
  });
});

describe("isToolResultMediaTrusted", () => {
  it("returns boolean for any input", () => {
    expect(typeof isToolResultMediaTrusted("tool", {})).toBe("boolean");
    expect(typeof isToolResultMediaTrusted(undefined, undefined)).toBe("boolean");
  });
});

describe("extractToolResultMediaPaths", () => {
  it("returns empty array for non-media results", () => {
    expect(extractToolResultMediaPaths("text")).toEqual([]);
  });
});
