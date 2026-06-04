import type { LookupFn } from "coreblow/plugin-sdk/ssrf-runtime";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchGuardState = vi.hoisted(() => ({
  calls: [] as Array<Record<string, unknown>>,
  responses: [] as Response[],
}));

vi.mock("coreblow/plugin-sdk/ssrf-runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("coreblow/plugin-sdk/ssrf-runtime")>();
  return {
    ...actual,
    fetchWithSsrFGuard: vi.fn(async (params: Record<string, unknown>) => {
      fetchGuardState.calls.push(params);
      const response = fetchGuardState.responses.shift();
      if (!response) {
        throw new Error("Missing mocked SearXNG response.");
      }
      return {
        response,
        finalUrl: String(params.url),
        release: vi.fn(),
      };
    }),
  };
});

import { runSearxngSearch, testing } from "./searxng-client.js";

function createLookupFn(addresses: Array<{ address: string; family: number }>): LookupFn {
  return vi.fn(async (_hostname: string, options?: unknown) => {
    if (typeof options === "number" || !options || !(options as { all?: boolean }).all) {
      return addresses[0];
    }
    return addresses;
  }) as unknown as LookupFn;
}

describe("searxng client", () => {
  beforeEach(() => {
    fetchGuardState.calls = [];
    fetchGuardState.responses = [];
    testing.SEARXNG_SEARCH_CACHE.clear();
  });

  it("preserves a configured base-path prefix when building the search URL", () => {
    expect(
      testing.buildSearxngSearchUrl({
        baseUrl: "https://search.example.com/searxng",
        query: "coreblow",
        categories: "general,news",
        language: "en",
      }),
    ).toBe(
      "https://search.example.com/searxng/search?q=coreblow&format=json&categories=general%2Cnews&language=en",
    );
  });

  it("parses SearXNG JSON results and applies the requested count cap", () => {
    expect(
      testing.parseSearxngResponseText(
        JSON.stringify({
          results: [
            { title: "One", url: "https://example.com/1", content: "A" },
            { title: "Two", url: "https://example.com/2", content: "B" },
          ],
        }),
        1,
      ),
    ).toEqual([{ title: "One", url: "https://example.com/1", content: "A" }]);
  });

  it("retries an empty category search with general results", async () => {
    fetchGuardState.responses.push(
      new Response(JSON.stringify({ results: [] }), { status: 200 }),
      new Response(
        JSON.stringify({
          results: [
            {
              title: "Jakarta hourly weather",
              url: "https://example.com/weather",
              content: "Hourly forecast",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await runSearxngSearch({
      baseUrl: "http://127.0.0.1:8888",
      query: "jakarta hourly weather",
      categories: "weather",
      count: 5,
    });

    expect(fetchGuardState.calls).toHaveLength(2);
    expect(new URL(String(fetchGuardState.calls[0]?.url)).searchParams.get("categories")).toBe(
      "weather",
    );
    expect(new URL(String(fetchGuardState.calls[1]?.url)).searchParams.get("categories")).toBe(
      "general",
    );
    expect(result.provider).toBe("searxng");
    expect(result.query).toBe("jakarta hourly weather");
    expect(result.count).toBe(1);
    const results = result.results as Array<{
      url?: string;
      siteName?: string;
      title?: string;
      snippet?: string;
    }>;
    expect(results).toHaveLength(1);
    expect(results[0]?.url).toBe("https://example.com/weather");
    expect(results[0]?.siteName).toBe("example.com");
    expect(results[0]?.title).toContain("Jakarta hourly weather");
    expect(results[0]?.snippet).toContain("Hourly forecast");
    expect(result.externalContent).toEqual({
      provider: "searxng",
      source: "web_search",
      untrusted: true,
      wrapped: true,
    });
  });

  it("does not retry empty general category searches", async () => {
    fetchGuardState.responses.push(
      new Response(JSON.stringify({ results: [] }), { status: 200 }),
    );

    const result = await runSearxngSearch({
      baseUrl: "http://127.0.0.1:8888",
      query: "coreblow",
      categories: "general",
      count: 5,
    });

    expect(fetchGuardState.calls).toHaveLength(1);
    const { tookMs, ...stableResult } = result;
    expect(typeof tookMs).toBe("number");
    expect(stableResult).toEqual({
      query: "coreblow",
      provider: "searxng",
      count: 0,
      externalContent: {
        provider: "searxng",
        source: "web_search",
        untrusted: true,
        wrapped: true,
      },
      results: [],
    });
  });

  it("detects category searches that should retry with general", () => {
    expect(testing.shouldRetryEmptyCategorySearchWithGeneral("weather")).toBe(true);
    expect(testing.shouldRetryEmptyCategorySearchWithGeneral("weather,news")).toBe(true);
    expect(testing.shouldRetryEmptyCategorySearchWithGeneral("general")).toBe(false);
    expect(testing.shouldRetryEmptyCategorySearchWithGeneral("general,news")).toBe(false);
    expect(testing.shouldRetryEmptyCategorySearchWithGeneral(undefined)).toBe(false);
  });

  it("preserves img_src from image search results", () => {
    expect(
      testing.parseSearxngResponseText(
        JSON.stringify({
          results: [
            {
              title: "Kitten",
              url: "https://example.com/kitten",
              content: "A cute kitten",
              img_src: "https://cdn.example.com/kitten.jpg",
            },
            {
              title: "No Image",
              url: "https://example.com/text",
              content: "Text only",
            },
            {
              title: "Bad Image",
              url: "https://example.com/bad",
              img_src: { url: "https://cdn.example.com/bad.jpg" },
            },
          ],
        }),
        10,
      ),
    ).toEqual([
      {
        title: "Kitten",
        url: "https://example.com/kitten",
        content: "A cute kitten",
        img_src: "https://cdn.example.com/kitten.jpg",
      },
      {
        title: "No Image",
        url: "https://example.com/text",
        content: "Text only",
        img_src: undefined,
      },
      {
        title: "Bad Image",
        url: "https://example.com/bad",
        content: undefined,
        img_src: undefined,
      },
    ]);
  });

  it("drops malformed result rows instead of failing the whole response", () => {
    expect(
      testing.parseSearxngResponseText(
        JSON.stringify({
          results: [
            { title: "One", url: "https://example.com/1", content: "A" },
            { title: { text: "bad" }, url: "https://example.com/2" },
            { title: "Three", url: 3, content: "bad-url" },
            { title: "Four", url: "https://example.com/4", content: { text: "bad" } },
          ],
        }),
        10,
      ),
    ).toEqual([
      { title: "One", url: "https://example.com/1", content: "A" },
      { title: "Four", url: "https://example.com/4", content: undefined },
    ]);
  });

  it("rejects invalid JSON bodies", () => {
    expect(() => testing.parseSearxngResponseText("{", 5)).toThrow(
      "SearXNG returned invalid JSON.",
    );
  });

  it("allows https public hosts", async () => {
    await expect(
      testing.validateSearxngBaseUrl(
        "https://search.example.com/searxng",
        createLookupFn([{ address: "93.184.216.34", family: 4 }]),
      ),
    ).resolves.toBe("strict");
  });

  it("allows cleartext private-network hosts", async () => {
    await expect(
      testing.validateSearxngBaseUrl(
        "http://matrix-synapse:8080",
        createLookupFn([{ address: "10.0.0.5", family: 4 }]),
      ),
    ).resolves.toBe("selfHosted");
  });

  it("rejects cleartext public hosts", async () => {
    await expect(
      testing.validateSearxngBaseUrl(
        "http://search.example.com:8080",
        createLookupFn([{ address: "93.184.216.34", family: 4 }]),
      ),
    ).rejects.toThrow(
      "SearXNG HTTP base URL must target a trusted private or loopback host. Use https:// for public hosts.",
    );
  });
});
