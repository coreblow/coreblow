import { describe, beforeEach, expect, it } from "vitest";
import { ApiPlayground } from "./api-playground.js";

let playground: ApiPlayground;

beforeEach(() => {
  playground = new ApiPlayground();
});

describe("ApiPlayground — construction", () => {
  it("constructs without throwing", () => {
    expect(() => new ApiPlayground()).not.toThrow();
  });

  it("starts with empty history (count = 0)", () => {
    expect(playground.count()).toBe(0);
  });
});

describe("ApiPlayground — getHistory()", () => {
  it("returns an empty array initially", () => {
    const h = playground.getHistory();
    expect(Array.isArray(h)).toBe(true);
    expect(h).toHaveLength(0);
  });

  it("respects limit parameter", () => {
    expect(playground.getHistory(5)).toHaveLength(0);
  });
});

describe("ApiPlayground — clearHistory()", () => {
  it("does not throw on empty history", () => {
    expect(() => playground.clearHistory()).not.toThrow();
  });

  it("resets count to zero", () => {
    playground.clearHistory();
    expect(playground.count()).toBe(0);
  });
});
