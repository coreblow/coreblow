import { describe, expect, it } from "vitest";
import {
  renderMarkdownToTerminal,
  highlightCode,
  formatCodeBlock,
} from "./output-formatter.js";

describe("renderMarkdownToTerminal()", () => {
  it("returns a string", () => {
    expect(typeof renderMarkdownToTerminal("# Hello")).toBe("string");
  });

  it("returns empty string for empty input", () => {
    expect(renderMarkdownToTerminal("")).toBe("");
  });

  it("handles plain text without markdown", () => {
    const result = renderMarkdownToTerminal("Hello CoreBlow");
    expect(result).toContain("Hello CoreBlow");
  });

  it("does not throw for any markdown input", () => {
    expect(() =>
      renderMarkdownToTerminal("**bold** *italic* `code` ### heading")
    ).not.toThrow();
  });
});

describe("highlightCode()", () => {
  it("returns a string", () => {
    expect(typeof highlightCode("const x = 1;", "js")).toBe("string");
  });

  it("returns non-empty for non-empty input", () => {
    const result = highlightCode("const x = 1;", "typescript");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("formatCodeBlock()", () => {
  it("returns a string", () => {
    expect(typeof formatCodeBlock("const x = 1;", "js")).toBe("string");
  });

  it("wraps code in a bordered block", () => {
    const result = formatCodeBlock("const x = 1;", "js");
    // Code is wrapped in ANSI-escaped bordered output
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("js");
  });
});
