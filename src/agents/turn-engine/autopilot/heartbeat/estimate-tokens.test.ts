import { describe, expect, it } from "vitest";
import { estimateTokens } from "./estimate-tokens.js";

describe("estimateTokens()", () => {
  it("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("returns 1 for 1–4 character string", () => {
    expect(estimateTokens("hi")).toBe(1);
    expect(estimateTokens("abcd")).toBe(1);
  });

  it("returns 2 for 5–8 character string", () => {
    expect(estimateTokens("hello!!")).toBe(2);
  });

  it("uses ceiling (Math.ceil(length/4))", () => {
    // 5 chars → ceil(5/4) = 2
    expect(estimateTokens("hello")).toBe(2);
    // 9 chars → ceil(9/4) = 3
    expect(estimateTokens("123456789")).toBe(3);
  });

  it("scales linearly with length", () => {
    const text400 = "a".repeat(400);
    const text800 = "a".repeat(800);
    expect(estimateTokens(text800)).toBe(estimateTokens(text400) * 2);
  });

  it("handles 1000-char text (returns 250)", () => {
    expect(estimateTokens("x".repeat(1000))).toBe(250);
  });
});
