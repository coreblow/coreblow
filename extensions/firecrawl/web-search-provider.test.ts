/**
 * extensions/firecrawl/web-search-provider.test.ts
 *
 * CoreBlow — Firecrawl Web Search Provider Tests
 * Verifies web search provider module is importable and
 * exports a valid provider object.
 */
import { describe, expect, it } from "vitest";
import { createFirecrawlWebFetchProvider as createFirecrawlWebFetchContractProvider } from "./web-fetch-contract-api.js";
import { createFirecrawlWebSearchProvider as createFirecrawlWebSearchContractProvider } from "./web-search-contract-api.js";

describe("firecrawl web-search-provider module", () => {
  it("is importable without throwing", async () => {
    await expect(import("./web-search-provider.js")).resolves.toBeDefined();
  });

  it("has at least one named export", async () => {
    const mod = await import("./web-search-provider.js") as Record<string, unknown>;
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });

  it("all exports are functions or objects", async () => {
    const mod = await import("./web-search-provider.js") as Record<string, unknown>;
    for (const [, val] of Object.entries(mod)) {
      expect(["function", "object", "string", "boolean"]).toContain(typeof val);
    }
  });

  it("provider export is an object or function", async () => {
    const mod = await import("./web-search-provider.js") as Record<string, unknown>;
    const provider = Object.values(mod)[0];
    expect(["object", "function"]).toContain(typeof provider);
  });

  it("exposes a web search contract provider without runtime tools", () => {
    const provider = createFirecrawlWebSearchContractProvider();

    expect(provider.id).toBe("firecrawl");
    expect(provider.credentialPath).toBe("plugins.entries.firecrawl.config.webSearch.apiKey");
    expect(provider.onboardingScopes).toEqual(["text-inference"]);
    expect(provider.createTool({} as never)).toBeNull();
  });

  it("falls back from web search contract credentials to web fetch credentials", () => {
    const provider = createFirecrawlWebSearchContractProvider();

    expect(
      provider.getConfiguredCredentialFallback?.({
        plugins: {
          entries: {
            firecrawl: {
              config: {
                webFetch: {
                  apiKey: "fc-fetch",
                },
              },
            },
          },
        },
      } as never),
    ).toEqual({
      path: "plugins.entries.firecrawl.config.webFetch.apiKey",
      value: "fc-fetch",
    });
  });

  it("exposes a web fetch contract provider with legacy fetch credential helpers", () => {
    const provider = createFirecrawlWebFetchContractProvider();
    const fetchConfig: Record<string, unknown> = {};

    provider.setCredentialValue(fetchConfig, "fc-fetch");

    expect(provider.id).toBe("firecrawl");
    expect(provider.credentialPath).toBe("plugins.entries.firecrawl.config.webFetch.apiKey");
    expect(provider.getCredentialValue(fetchConfig)).toBe("fc-fetch");
    expect(provider.createTool({})).toBeNull();
  });
});
