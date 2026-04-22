import { describe, beforeEach, expect, it } from "vitest";
import {
  clearSearchIndex,
  getSearchStats,
  indexMemory,
  rankResults,
  removeMemory,
} from "./search.js";

beforeEach(() => {
  clearSearchIndex();
});

describe("indexMemory()", () => {
  it("increases document count after indexing", () => {
    indexMemory("m1", "CoreBlow is an AI gateway platform");
    const stats = getSearchStats();
    expect(stats.documents).toBeGreaterThan(0);
  });

  it("indexes multiple documents", () => {
    indexMemory("m1", "AI agents");
    indexMemory("m2", "memory retrieval");
    expect(getSearchStats().documents).toBe(2);
  });

  it("accepts optional metadata", () => {
    expect(() => indexMemory("m1", "test", { tag: "wave1" })).not.toThrow();
  });
});

describe("removeMemory()", () => {
  it("returns true when removing existing document", () => {
    indexMemory("m1", "to be removed");
    expect(removeMemory("m1")).toBe(true);
  });

  it("decrements document count", () => {
    indexMemory("m1", "doc1");
    indexMemory("m2", "doc2");
    removeMemory("m1");
    expect(getSearchStats().documents).toBe(1);
  });

  it("returns false for non-existing document", () => {
    expect(removeMemory("ghost")).toBe(false);
  });
});

describe("rankResults()", () => {
  it("returns same array for empty input", () => {
    expect(rankResults([])).toEqual([]);
  });

  it("sorts results by descending score", () => {
    const results = [
      { id: "a", content: "A", metadata: {}, score: 0.5 },
      { id: "b", content: "B", metadata: {}, score: 0.9 },
      { id: "c", content: "C", metadata: {}, score: 0.1 },
    ];
    const ranked = rankResults(results);
    expect(ranked[0]?.score).toBeGreaterThanOrEqual(ranked[1]?.score ?? 0);
  });
});

describe("getSearchStats()", () => {
  it("returns zero documents initially", () => {
    const stats = getSearchStats();
    expect(stats.documents).toBe(0);
  });

  it("returns stats with terms and avgDocLength after indexing", () => {
    indexMemory("m1", "hello world CoreBlow");
    const stats = getSearchStats();
    expect(stats.documents).toBe(1);
    expect(stats.terms).toBeGreaterThan(0);
    expect(stats.avgDocLength).toBeGreaterThan(0);
  });
});

describe("clearSearchIndex()", () => {
  it("resets document count to zero", () => {
    indexMemory("m1", "doc");
    clearSearchIndex();
    expect(getSearchStats().documents).toBe(0);
  });
});
