/**
 * extensions/brave/src/brave-web-search-provider.test.ts
 *
 * CoreBlow — Brave Extension Web Search Provider Tests
 */
import { describe, expect, it } from "vitest";
import { createBraveWebSearchProvider } from "./brave-web-search-provider.js";
import {
  createBraveWebSearchProviderBase,
  mapBraveLlmContextResults,
  normalizeBraveCountry,
  normalizeBraveLanguageParams,
  resolveBraveMode,
} from "./brave-web-search-provider.shared.js";
import { createBraveWebSearchProvider as createBraveWebSearchContractProvider } from "../web-search-contract-api.js";

describe("createBraveWebSearchProvider", () => {
  it("is a function", () => {
    expect(typeof createBraveWebSearchProvider).toBe("function");
  });

  it("returns a non-null object", () => {
    const provider = createBraveWebSearchProvider();
    expect(typeof provider).toBe("object");
    expect(provider).not.toBeNull();
  });

  it("returns object with at least one field", () => {
    const provider = createBraveWebSearchProvider();
    expect(Object.keys(provider).length).toBeGreaterThan(0);
  });

  it("does not throw when called", () => {
    expect(() => createBraveWebSearchProvider()).not.toThrow();
  });

  it("exposes contract provider metadata without runtime tools", () => {
    const provider = createBraveWebSearchContractProvider();

    expect(provider.id).toBe("brave");
    expect(provider.credentialPath).toBe("plugins.entries.brave.config.webSearch.apiKey");
    expect(provider.createTool({} as never)).toBeNull();
  });

  it("uses scoped Brave credentials in the contract base", () => {
    const provider = createBraveWebSearchProviderBase();
    const searchConfig: Record<string, unknown> = {};

    provider.setCredentialValue(searchConfig, "BSA-token");

    expect(provider.getCredentialValue(searchConfig)).toBe("BSA-token");
  });

  it("normalizes Brave language and country parameters", () => {
    expect(normalizeBraveCountry("de")).toBe("DE");
    expect(normalizeBraveCountry("unknown")).toBe("ALL");
    expect(normalizeBraveLanguageParams({ search_lang: "en-US", ui_lang: "ja" })).toEqual({
      search_lang: "jp",
      ui_lang: "en-US",
    });
    expect(normalizeBraveLanguageParams({ search_lang: "xx" })).toEqual({
      invalidField: "search_lang",
    });
  });

  it("maps Brave LLM context results with site names", () => {
    expect(
      mapBraveLlmContextResults({
        grounding: {
          generic: [
            {
              url: "https://example.com/post",
              title: "Example",
              snippets: ["one", "", "two"],
            },
          ],
        },
      }),
    ).toEqual([
      {
        url: "https://example.com/post",
        title: "Example",
        snippets: ["one", "two"],
        siteName: "example.com",
      },
    ]);
  });

  it("resolves llm-context mode only when explicitly configured", () => {
    expect(resolveBraveMode()).toBe("web");
    expect(resolveBraveMode({ mode: "llm-context" })).toBe("llm-context");
    expect(resolveBraveMode({ mode: "other" })).toBe("web");
  });
});
