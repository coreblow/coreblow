import {
  DEFAULT_SEARCH_COUNT,
  readNumberParam,
  readStringParam,
  resolveSearchCount,
  wrapWebContent,
} from "coreblow/plugin-sdk/provider-web-search";

export async function executeMiniMaxWebSearchProviderTool(
  _ctx: { config?: Record<string, unknown>; searchConfig?: Record<string, unknown> },
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const query = readStringParam(args, "query", { required: true });
  const count = resolveSearchCount(
    readNumberParam(args, "count", { integer: true }) ?? undefined,
    DEFAULT_SEARCH_COUNT,
  );
  return {
    query: wrapWebContent(query, "web_search"),
    results: [],
    relatedSearches: [],
    provider: "minimax",
    count,
  };
}

export const testing = {
  executeMiniMaxWebSearchProviderTool,
};
