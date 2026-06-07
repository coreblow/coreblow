import { describe, expect, it } from "vitest";
import { createMiniMaxWebSearchProvider } from "./minimax-web-search-provider.js";
import { executeMiniMaxWebSearchProviderTool } from "./minimax-web-search-provider.runtime.js";

describe("createMiniMaxWebSearchProvider", () => {
  it("exposes MiniMax web search metadata and runtime", async () => {
    const provider = createMiniMaxWebSearchProvider();
    expect(provider.id).toBe("minimax");
    expect(provider.envVars).toContain("MINIMAX_API_KEY");

    const result = await executeMiniMaxWebSearchProviderTool({}, { query: "coreblow", count: 2 });
    expect(result).toMatchObject({
      provider: "minimax",
      count: 2,
      results: [],
    });
  });
});
