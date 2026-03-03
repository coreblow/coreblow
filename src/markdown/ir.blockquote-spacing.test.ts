import { describe, it, expect } from "vitest";

import { markdownToIR, markdownToIRWithMeta, chunkMarkdownIR } from "./ir.js";

describe("blockquote spacing", () => {
  it("resolves all imports without errors", () => {
    expect(markdownToIR).toBeDefined();
    expect(markdownToIRWithMeta).toBeDefined();
    expect(chunkMarkdownIR).toBeDefined();
  });

  it.todo("should have double newline (one blank line) between blockquote and paragraph");
  it.todo("should not produce triple newlines");
  it.todo("should have double newline between two blockquotes");
  it.todo("should not produce triple newlines between blockquotes");
  it.todo("should handle nested blockquotes correctly");
  it.todo("should not produce triple newlines in nested blockquotes");
  it.todo("should handle deeply nested blockquotes");
  it.todo("should have double newline between blockquote and heading");
  it.todo("should have double newline between blockquote and list");
  it.todo("should have double newline between blockquote and code block");
  it.todo("should have double newline between blockquote and horizontal rule");
  it.todo("should handle multi-paragraph blockquote followed by paragraph");
  it.todo("should include prefix and maintain proper spacing");
  it.todo("should handle empty blockquote followed by paragraph");
  it.todo("should handle blockquote at end of document");
  it.todo("should handle multiple blockquotes with paragraphs between");
  it.todo("paragraphs should have double newline separation");
  it.todo("list followed by paragraph should have double newline");
  it.todo("heading followed by paragraph should have double newline");
});
