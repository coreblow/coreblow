import { describe, expect, it } from "vitest";
import {
  CHARS_PER_TOKEN_ESTIMATE,
  estimateStringChars,
  estimateTokensFromChars,
} from "./cjk-chars.js";

describe("estimateStringChars", () => {
  it("returns plain string length for ASCII text", () => {
    expect(estimateStringChars("hello world")).toBe(11);
  });

  it("returns 0 for empty text", () => {
    expect(estimateStringChars("")).toBe(0);
  });

  it("weights CJK text so chars divided by the shared estimate approximates tokens", () => {
    expect(estimateStringChars("你好世")).toBe(12);
    const cjk = "这是一个测试用的句子呢";
    expect(Math.ceil(estimateStringChars(cjk) / CHARS_PER_TOKEN_ESTIMATE)).toBe(cjk.length);
  });

  it("handles Japanese and Korean scripts", () => {
    expect(estimateStringChars("こんにちは")).toBe(20);
    expect(estimateStringChars("カタカナ")).toBe(16);
    expect(estimateStringChars("안녕하세요")).toBe(20);
  });

  it("counts CJK extension characters as one code point", () => {
    expect(estimateStringChars("𠀀")).toBe(CHARS_PER_TOKEN_ESTIMATE);
    expect(estimateStringChars("你𠀀好")).toBe(12);
  });

  it("does not collapse non-CJK surrogate pairs", () => {
    expect(estimateStringChars("😀")).toBe(2);
    expect(estimateStringChars("你😀")).toBe(6);
  });
});

describe("estimateTokensFromChars", () => {
  it("divides by the shared estimate and rounds up", () => {
    expect(estimateTokensFromChars(8)).toBe(2);
    expect(estimateTokensFromChars(9)).toBe(3);
    expect(estimateTokensFromChars(0)).toBe(0);
    expect(estimateTokensFromChars(-10)).toBe(0);
  });
});
