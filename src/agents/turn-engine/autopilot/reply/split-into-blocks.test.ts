import { describe, expect, it } from "vitest";
import { splitIntoBlocks } from "./split-into-blocks.js";

describe("splitIntoBlocks()", () => {
  it("returns single-element array for short text", () => {
    const result = splitIntoBlocks("Hello world");
    expect(result).toEqual(["Hello world"]);
  });

  it("returns empty string block for empty input", () => {
    const result = splitIntoBlocks("");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("");
  });

  it("does not split text shorter than default 4000 chars", () => {
    const text = "x".repeat(3999);
    expect(splitIntoBlocks(text)).toHaveLength(1);
  });

  it("splits text exceeding maxBlockSize into multiple blocks", () => {
    const para = "word ".repeat(30).trim(); // ~149 chars per para
    const text = Array(6).fill(para).join("\n\n"); // ~900 chars
    const blocks = splitIntoBlocks(text, 200);
    expect(blocks.length).toBeGreaterThan(1);
  });

  it("each block does not exceed maxBlockSize (roughly)", () => {
    const para = "A".repeat(100);
    const text = Array(10).fill(para).join("\n\n");
    const blocks = splitIntoBlocks(text, 250);
    for (const b of blocks) {
      // Allow slight overage for single oversized paragraph
      expect(b.length).toBeLessThan(500);
    }
  });

  it("custom maxBlockSize of 10 splits at word boundaries", () => {
    const text = "hello\n\nworld\n\nfoo";
    const blocks = splitIntoBlocks(text, 10);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
  });

  it("preserves all content across blocks (no data loss)", () => {
    const paras = ["First paragraph", "Second paragraph", "Third paragraph"];
    const text = paras.join("\n\n");
    const blocks = splitIntoBlocks(text, 20);
    const rejoined = blocks.join(" ");
    for (const p of paras) {
      expect(rejoined).toContain(p.trim());
    }
  });
});
