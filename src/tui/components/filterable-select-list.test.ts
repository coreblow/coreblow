import { describe, it, expect } from "vitest";
import {
  FilterableSelectList,
} from "./filterable-select-list.js";

describe("filterable-select-list — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof FilterableSelectList).toBe("function");
  });
});
