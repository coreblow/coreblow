/**
 * src/infra/inverted-index.test.ts
 *
 * CoreBlow — Inverted Index Tests
 * Verifies InvertedIndex: add, search, size, clear.
 */
import { describe, beforeEach, expect, it } from "vitest";
import { InvertedIndex } from "./inverted-index.js";

let idx: InvertedIndex;

beforeEach(() => {
  idx = new InvertedIndex();
});

describe("InvertedIndex — construction", () => {
  it("constructs without throwing", () => {
    expect(() => new InvertedIndex()).not.toThrow();
  });

  it("starts empty (search returns [])", () => {
    expect(idx.search("anything")).toEqual([]);
  });
});

describe("InvertedIndex.add()", () => {
  it("adds a document without throwing", () => {
    expect(() => idx.add("doc1", "title", "CoreBlow agent runtime")).not.toThrow();
  });

  it("makes term searchable after add", () => {
    idx.add("doc1", "title", "CoreBlow agent runtime");
    const results = idx.search("coreblow");
    expect(results.length).toBeGreaterThan(0);
  });

  it("sets docId correctly", () => {
    idx.add("doc-abc", "body", "hello world");
    const results = idx.search("hello");
    expect(results[0]?.docId).toBe("doc-abc");
  });

  it("filters stopwords (skips 'the', 'a', 'in')", () => {
    idx.add("doc1", "content", "the a in");
    expect(idx.search("the")).toHaveLength(0);
  });
});

describe("InvertedIndex.search()", () => {
  it("returns empty array for unknown term", () => {
    expect(idx.search("nonexistent")).toEqual([]);
  });

  it("returns postings with tf (term frequency)", () => {
    idx.add("doc1", "body", "CoreBlow CoreBlow system");
    const results = idx.search("coreblow");
    expect(results[0]?.tf).toBeGreaterThan(0);
  });

  it("is case-insensitive", () => {
    idx.add("doc1", "title", "COREBLOW");
    expect(idx.search("coreblow").length).toBeGreaterThan(0);
  });
});
