// @ts-nocheck
import { describe, expect, it } from "vitest";
import { SearchableSelectList } from "./searchable-select-list.js";

describe("SearchableSelectList", () => {
  it("constructs with items", () => {
    const list = new SearchableSelectList({
      items: [
        { label: "One", value: "1" },
        { label: "Two", value: "2" },
      ],
    });
    expect(list).toBeDefined();
  });
});
