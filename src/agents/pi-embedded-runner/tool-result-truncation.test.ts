import { describe, expect, it } from "vitest";
import {
  HARD_MAX_TOOL_RESULT_CHARS,
  truncateToolResultText,
  calculateMaxToolResultChars,
} from "./tool-result-truncation.js";

describe("truncateToolResultText", () => {
  it("returns text unchanged when under limit", () => {
    const short = "Hello, world!";
    expect(truncateToolResultText(short, 100)).toBe(short);
  });

  it("truncates text that exceeds limit", () => {
    const long = "x".repeat(500_000);
    const result = truncateToolResultText(long, HARD_MAX_TOOL_RESULT_CHARS);
    expect(result.length).toBeLessThanOrEqual(HARD_MAX_TOOL_RESULT_CHARS);
    expect(result.length).toBeLessThan(long.length);
  });

  it("exports the hard max constant", () => {
    expect(HARD_MAX_TOOL_RESULT_CHARS).toBe(400_000);
  });

  it("calculates max chars from context window tokens", () => {
    const maxChars = calculateMaxToolResultChars(128_000);
    expect(typeof maxChars).toBe("number");
    expect(maxChars).toBeGreaterThan(0);
    expect(maxChars).toBeLessThanOrEqual(HARD_MAX_TOOL_RESULT_CHARS);
  });

  it("scales max chars with context window", () => {
    const small = calculateMaxToolResultChars(16_000);
    const large = calculateMaxToolResultChars(128_000);
    expect(large).toBeGreaterThanOrEqual(small);
  });
});
