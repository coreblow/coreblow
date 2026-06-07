import { describe, expect, it } from "vitest";
import { createOllamaWebSearchProvider, testing } from "./web-search-provider.js";

describe("ollama web search provider runtime", () => {
  it("exposes runtime contract helpers", () => {
    expect(createOllamaWebSearchProvider().id).toBe("ollama");
    expect(testing.paths.hosted).toBe("/api/web_search");
  });
});
