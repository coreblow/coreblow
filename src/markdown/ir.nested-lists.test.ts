import { describe, it, expect } from "vitest";

import { markdownToIR, markdownToIRWithMeta, chunkMarkdownIR } from "./ir.js";

describe("Nested Lists - 2 Level Nesting", () => {
  it("resolves all imports without errors", () => {
    expect(markdownToIR).toBeDefined();
    expect(markdownToIRWithMeta).toBeDefined();
    expect(chunkMarkdownIR).toBeDefined();
  });

  it.todo("renders bullet items nested inside bullet items with proper indentation");
  it.todo("renders ordered items nested inside bullet items");
  it.todo("renders bullet items nested inside ordered items");
  it.todo("renders ordered items nested inside ordered items");
  it.todo("renders 3 levels of bullet nesting");
  it.todo("renders 4 levels of bullet nesting");
  it.todo("renders 3 levels with multiple items at each level");
  it.todo("renders complex mixed nesting (bullet > ordered > bullet)");
  it.todo("renders ordered > bullet > ordered nesting");
  it.todo("does not produce triple newlines in nested lists");
  it.todo("does not produce double newlines between nested items");
  it.todo("properly terminates top-level list (trimmed output)");
  it.todo("handles empty parent with nested items");
  it.todo("handles nested list as first child of parent item");
  it.todo("handles sibling nested lists at same level");
  it.todo("adds blank line between bullet list and following paragraph");
  it.todo("adds blank line between ordered list and following paragraph");
  it.todo("does not produce triple newlines");
});
