import { describe, expect, it } from "vitest";
import { chunkItems } from "./chunk-items.js";

describe("chunkItems", () => {
  it("splits an array into chunks of the specified size", () => {
    expect(chunkItems([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns a single chunk when items fit", () => {
    expect(chunkItems([1, 2, 3], 5)).toEqual([[1, 2, 3]]);
  });

  it("returns empty array for empty input", () => {
    expect(chunkItems([], 3)).toEqual([]);
  });

  it("handles chunk size of 1", () => {
    expect(chunkItems([1, 2, 3], 1)).toEqual([[1], [2], [3]]);
  });

  it("handles exact multiple", () => {
    expect(chunkItems([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });

  it("works with string arrays", () => {
    expect(chunkItems(["a", "b", "c"], 2)).toEqual([["a", "b"], ["c"]]);
  });
});
