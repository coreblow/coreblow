/**
 * extensions/exa/src/exa-web-search-provider.test.ts
 *
 * CoreBlow — Exa Extension Web Search Provider Tests
 */
import { describe, expect, it } from "vitest";
import { createExaWebSearchProvider } from "./exa-web-search-provider.js";
import { createExaWebSearchProviderBase } from "./exa-web-search-provider.shared.js";
import { createExaWebSearchProvider as createExaWebSearchContractProvider } from "../web-search-contract-api.js";

describe("createExaWebSearchProvider", () => {
  it("is a function", () => {
    expect(typeof createExaWebSearchProvider).toBe("function");
  });

  it("returns a non-null object", () => {
    const provider = createExaWebSearchProvider();
    expect(typeof provider).toBe("object");
    expect(provider).not.toBeNull();
  });

  it("returns object with at least one field", () => {
    const provider = createExaWebSearchProvider();
    expect(Object.keys(provider).length).toBeGreaterThan(0);
  });

  it("does not throw when called", () => {
    expect(() => createExaWebSearchProvider()).not.toThrow();
  });

  it("exposes contract provider metadata without runtime tools", () => {
    const provider = createExaWebSearchContractProvider();

    expect(provider.id).toBe("exa");
    expect(provider.credentialPath).toBe("plugins.entries.exa.config.webSearch.apiKey");
    expect(provider.onboardingScopes).toEqual(["text-inference"]);
    expect(provider.createTool({} as never)).toBeNull();
  });

  it("uses scoped Exa credentials in the contract base", () => {
    const provider = createExaWebSearchProviderBase();
    const searchConfig: Record<string, unknown> = {};

    provider.setCredentialValue(searchConfig, "exa-token");

    expect(provider.getCredentialValue(searchConfig)).toBe("exa-token");
  });

  it("applies Exa plugin selection through the contract base", () => {
    const provider = createExaWebSearchProviderBase();

    expect(provider.applySelectionConfig?.({})?.plugins?.entries?.exa?.enabled).toBe(true);
  });
});
