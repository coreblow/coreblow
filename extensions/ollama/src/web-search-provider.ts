import type { CoreBlowConfig } from "coreblow/plugin-sdk/config-contracts";
import {
  readResponseText,
  resolveSearchCount,
  truncateText,
  wrapWebContent,
} from "coreblow/plugin-sdk/provider-web-search";
import { fetchWithSsrFGuard } from "coreblow/plugin-sdk/ssrf-runtime";
import { OLLAMA_CLOUD_BASE_URL, OLLAMA_DEFAULT_BASE_URL } from "./defaults.js";
import { readProviderBaseUrl } from "./provider-base-url.js";
import { buildOllamaBaseUrlSsrFPolicy, resolveOllamaApiBase } from "./provider-models.js";
import { createOllamaWebSearchProvider as createOllamaWebSearchProviderContract } from "../web-search-contract-api.js";

const OLLAMA_HOSTED_WEB_SEARCH_PATH = "/api/web_search";
const OLLAMA_LOCAL_WEB_SEARCH_PROXY_PATH = "/api/experimental/web_search";
const DEFAULT_OLLAMA_WEB_SEARCH_COUNT = 5;
const DEFAULT_OLLAMA_WEB_SEARCH_TIMEOUT_MS = 15_000;
const OLLAMA_WEB_SEARCH_SNIPPET_MAX_CHARS = 300;

type OllamaWebSearchResult = {
  title?: string;
  url?: string;
  content?: string;
};

type OllamaWebSearchResponse = {
  results?: OllamaWebSearchResult[];
};

export const testing = {
  paths: {
    hosted: OLLAMA_HOSTED_WEB_SEARCH_PATH,
    localProxy: OLLAMA_LOCAL_WEB_SEARCH_PROXY_PATH,
  },
};

export function createOllamaWebSearchProvider() {
  return createOllamaWebSearchProviderContract();
}

function resolveOllamaWebSearchBaseUrl(config?: CoreBlowConfig): string {
  const configuredBaseUrl = readProviderBaseUrl(config?.models?.providers?.ollama);
  return configuredBaseUrl ? resolveOllamaApiBase(configuredBaseUrl) : OLLAMA_DEFAULT_BASE_URL;
}

function isOllamaCloudBaseUrl(baseUrl: string): boolean {
  try {
    const parsed = new URL(baseUrl);
    return parsed.protocol === "https:" && parsed.hostname === "ollama.com";
  } catch {
    return false;
  }
}

function normalizeOllamaWebSearchResult(
  result: OllamaWebSearchResult,
): { title: string; url: string; content: string } | null {
  const url = result.url?.trim();
  if (!url) {
    return null;
  }
  return {
    title: result.title?.trim() ?? "",
    url,
    content: result.content?.trim() ?? "",
  };
}

export async function runOllamaWebSearch(params: {
  config?: CoreBlowConfig;
  query: string;
  count?: number;
}): Promise<Record<string, unknown>> {
  const query = params.query.trim();
  if (!query) {
    throw new Error("query parameter is required");
  }
  const count = resolveSearchCount(params.count, DEFAULT_OLLAMA_WEB_SEARCH_COUNT);
  const baseUrl = resolveOllamaWebSearchBaseUrl(params.config);
  const attempts = isOllamaCloudBaseUrl(baseUrl)
    ? [{ baseUrl, path: OLLAMA_HOSTED_WEB_SEARCH_PATH }]
    : [
        { baseUrl, path: OLLAMA_LOCAL_WEB_SEARCH_PROXY_PATH },
        { baseUrl, path: OLLAMA_HOSTED_WEB_SEARCH_PATH },
        { baseUrl: OLLAMA_CLOUD_BASE_URL, path: OLLAMA_HOSTED_WEB_SEARCH_PATH },
      ];
  let lastError: Error | undefined;
  for (const attempt of attempts) {
    const { response, release } = await fetchWithSsrFGuard({
      url: `${attempt.baseUrl}${attempt.path}`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, max_results: count }),
        signal: AbortSignal.timeout(DEFAULT_OLLAMA_WEB_SEARCH_TIMEOUT_MS),
      },
      policy: buildOllamaBaseUrlSsrFPolicy(attempt.baseUrl),
      auditContext: "ollama-web-search.search",
    });
    try {
      if (response.status === 404) {
        lastError = new Error(`Ollama web search failed (${response.status})`);
        continue;
      }
      if (!response.ok) {
        const detail = await readResponseText(response, { maxBytes: 64_000 });
        throw new Error(`Ollama web search failed (${response.status}): ${detail.text}`.trim());
      }
      const payload = (await response.json()) as OllamaWebSearchResponse;
      const results = (payload.results ?? [])
        .map(normalizeOllamaWebSearchResult)
        .filter((result): result is { title: string; url: string; content: string } =>
          Boolean(result),
        )
        .slice(0, count);
      return {
        results: results.map((result) => ({
          ...result,
          content: truncateText(wrapWebContent(result.content), OLLAMA_WEB_SEARCH_SNIPPET_MAX_CHARS),
        })),
      };
    } finally {
      await release();
    }
  }
  throw lastError ?? new Error("Ollama web search failed");
}
