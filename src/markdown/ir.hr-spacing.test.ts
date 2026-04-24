import { describe, it, expect } from "vitest";

import { markdownToIR, markdownToIRWithMeta, chunkMarkdownIR } from "./ir.js";

describe("hr (thematic break) spacing", () => {
  it("resolves all imports without errors", () => {
    expect(markdownToIR).toBeDefined();
    expect(markdownToIRWithMeta).toBeDefined();
    expect(chunkMarkdownIR).toBeDefined();
  });

  it.todo("just hr alone renders as separator");
  it.todo("hr interrupting paragraph (setext heading case)");
  it.todo("hr between paragraphs should render with separator");
  it.todo("hr between paragraphs using *** should render with separator");
  it.todo("hr between paragraphs using ___ should render with separator");
  it.todo("consecutive hrs should produce multiple separators");
  it.todo("hr at document end renders separator");
  it.todo("hr at document start renders separator");
  it.todo("should not produce triple newlines regardless of hr placement");
  it.todo("multiple consecutive hrs between paragraphs should each render as separator");
  it.todo("hr between list items renders as separator without extra spacing");
  it.todo("hr followed immediately by heading");
  it.todo("heading followed by hr");
});
