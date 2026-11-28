import type { AgentTool } from "@mariozechner/pi-agent-core";

export const TOOL_SEARCH_BRIDGE_NAMES = ["tool_search", "tool_describe", "tool_call"] as const;

export const DEFAULT_TOOL_SEARCH_CORE_TOOLS = [
  "read",
  "write",
  "memory_search",
  ...TOOL_SEARCH_BRIDGE_NAMES,
] as const;

export type ToolSearchListingTier = "full" | "names" | "bare";

export type ToolSearchCatalogEntry = {
  name: string;
  summary: string;
  description: string;
  parameters: unknown;
  searchText: string;
  tool: AgentTool;
};

export type ToolSearchCatalog = {
  entries: ReadonlyArray<ToolSearchCatalogEntry>;
  byName: ReadonlyMap<string, ToolSearchCatalogEntry>;
};

const CHARS_PER_TOKEN = 4;

function firstSentenceSummary(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) {
    return "No description provided.";
  }
  const match = /^(.{1,120}?[.!?])(?:\s|$)/.exec(clean);
  if (match?.[1]) {
    return match[1];
  }
  return clean.length <= 120 ? clean : `${clean.slice(0, 117)}...`;
}

export function estimateToolSchemaTokens(tools: ReadonlyArray<{ name: string; description?: string; parameters?: unknown }>): number {
  const chars = tools.reduce((total, tool) => {
    const serialized = JSON.stringify({
      name: tool.name,
      description: tool.description ?? "",
      parameters: tool.parameters ?? {},
    });
    return total + serialized.length;
  }, 0);
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

/**
 * Builds a stateless catalog from the live policy-filtered tool array on every assembly.
 * Never persisted per session so tool additions/removals never drift.
 */
export function buildStatelessToolCatalog(deferredTools: ReadonlyArray<AgentTool>): ToolSearchCatalog {
  const sorted = [...deferredTools].toSorted((a, b) => a.name.localeCompare(b.name));
  const entries: ToolSearchCatalogEntry[] = [];
  const byName = new Map<string, ToolSearchCatalogEntry>();
  for (const tool of sorted) {
    const description = typeof tool.description === "string" ? tool.description.trim() : "";
    const summary = firstSentenceSummary(description);
    const paramKeys =
      tool.parameters &&
      typeof tool.parameters === "object" &&
      "properties" in tool.parameters &&
      tool.parameters.properties &&
      typeof tool.parameters.properties === "object"
        ? Object.keys(tool.parameters.properties as Record<string, unknown>).join(" ")
        : "";
    const entry: ToolSearchCatalogEntry = {
      name: tool.name,
      summary,
      description,
      parameters: tool.parameters ?? { type: "object", properties: {} },
      searchText: `${tool.name} ${description} ${paramKeys}`.toLowerCase(),
      tool,
    };
    entries.push(entry);
    byName.set(tool.name, entry);
  }
  return { entries, byName };
}

export function searchToolCatalog(
  catalog: ToolSearchCatalog,
  query: string,
  limit = 8,
): ToolSearchCatalogEntry[] {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9_.-]+/u)
    .map((token) => token.trim())
    .filter(Boolean);
  const clampedLimit = Math.max(1, Math.min(25, Math.floor(limit)));
  if (tokens.length === 0) {
    return catalog.entries.slice(0, clampedLimit);
  }
  const scored: Array<{ entry: ToolSearchCatalogEntry; score: number }> = [];
  for (const entry of catalog.entries) {
    let score = 0;
    const lowerName = entry.name.toLowerCase();
    for (const token of tokens) {
      if (lowerName === token) {
        score += 100;
      } else if (lowerName.includes(token)) {
        score += 25;
      }
      if (entry.searchText.includes(token)) {
        score += 10;
      }
    }
    if (score > 0) {
      scored.push({ entry, score });
    }
  }
  scored.sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name));
  return scored.slice(0, clampedLimit).map((item) => item.entry);
}

/**
 * Formats a compact deferred-tool manifest using `full -> names -> bare` tiers
 * bounded by `min(listingMaxTokens, thresholdPct% * contextWindowTokens)`.
 */
export function buildCompactToolListing(params: {
  catalog: ToolSearchCatalog;
  contextWindowTokens?: number;
  thresholdPct?: number;
  listingMaxTokens?: number;
}): { text: string; tier: ToolSearchListingTier } {
  const { catalog } = params;
  if (catalog.entries.length === 0) {
    return { text: "", tier: "bare" };
  }
  const thresholdPct = Math.max(0.1, Math.min(100, params.thresholdPct ?? 5));
  const listingMaxTokens = Math.max(200, Math.min(60_000, params.listingMaxTokens ?? 4000));
  const contextTokens =
    typeof params.contextWindowTokens === "number" && params.contextWindowTokens > 0
      ? params.contextWindowTokens
      : 128_000;
  const budgetTokens = Math.min(
    listingMaxTokens,
    Math.max(120, Math.floor((contextTokens * thresholdPct) / 100)),
  );
  const budgetChars = budgetTokens * CHARS_PER_TOKEN;

  const header =
    "## Deferred Tools (Progressive Disclosure)\n" +
    "To keep context compact, the tools below are deferred. Use `tool_search` to discover tools, `tool_describe` to inspect schemas, and `tool_call` to invoke them.\n";

  const fullBlock =
    header + catalog.entries.map((entry) => `- ${entry.name}: ${entry.summary}`).join("\n");
  if (fullBlock.length <= budgetChars) {
    return { text: fullBlock, tier: "full" };
  }

  const namesBlock = header + `Available deferred tools: ${catalog.entries.map((e) => e.name).join(", ")}`;
  if (namesBlock.length <= budgetChars) {
    return { text: namesBlock, tier: "names" };
  }

  const bareBlock =
    `${header}${catalog.entries.length} deferred tools available. Call tool_search(query) to find tools by capability.`;
  return { text: bareBlock, tier: "bare" };
}
