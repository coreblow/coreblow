import { describe, it, expect } from "vitest";

import { markdownToIR, markdownToIRWithMeta, chunkMarkdownIR } from "./ir.js";

describe("markdownToIR tableMode code - style overlap", () => {
  it("resolves all imports without errors", () => {
    expect(markdownToIR).toBeDefined();
    expect(markdownToIRWithMeta).toBeDefined();
    expect(chunkMarkdownIR).toBeDefined();
  });

  it.todo("should not have overlapping styles when cell has bold text");
  it.todo("should not have overlapping styles when cell has italic text");
  it.todo("should not have overlapping styles when cell has inline code");
  it.todo("should not have overlapping styles with multiple styled cells");
});
