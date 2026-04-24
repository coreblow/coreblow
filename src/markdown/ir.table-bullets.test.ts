import { describe, it, expect } from "vitest";

import { markdownToIR, markdownToIRWithMeta, chunkMarkdownIR } from "./ir.js";

describe("markdownToIR tableMode bullets", () => {
  it("resolves all imports without errors", () => {
    expect(markdownToIR).toBeDefined();
    expect(markdownToIRWithMeta).toBeDefined();
    expect(chunkMarkdownIR).toBeDefined();
  });

  it.todo("converts simple table to bullets");
  it.todo("handles table with multiple columns");
  it.todo("leaves table syntax untouched by default");
  it.todo("handles empty cells gracefully");
  it.todo("bolds row labels in bullets mode");
  it.todo("renders tables as code blocks in code mode");
  it.todo("preserves inline styles and links in bullets mode");
});
