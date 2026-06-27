import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// provider-model-id-normalize
// ---------------------------------------------------------------------------
import {
  normalizeAntigravityPreviewModelId,
  normalizeGooglePreviewModelId,
} from "./provider-model-id-normalize.js";

describe("provider-model-id-normalize", () => {
  it("normalizeGooglePreviewModelId: leaves unknown ids unchanged", () => {
    expect(normalizeGooglePreviewModelId("gemini-1.5-flash")).toBe("gemini-1.5-flash");
  });

  it("normalizeGooglePreviewModelId: maps gemini-3-pro to preview", () => {
    expect(normalizeGooglePreviewModelId("gemini-3-pro")).toBe("gemini-3.1-pro-preview");
  });

  it("normalizeGooglePreviewModelId: maps gemini-3-flash to preview", () => {
    expect(normalizeGooglePreviewModelId("gemini-3-flash")).toBe("gemini-3-flash-preview");
  });

  it("normalizeGooglePreviewModelId: maps gemini-3.1-pro to preview", () => {
    expect(normalizeGooglePreviewModelId("gemini-3.1-pro")).toBe("gemini-3.1-pro-preview");
  });

  it("normalizeGooglePreviewModelId: handles google/ prefix recursively", () => {
    expect(normalizeGooglePreviewModelId("google/gemini-3-flash")).toBe(
      "google/gemini-3-flash-preview",
    );
  });

  it("normalizeGooglePreviewModelId: prefixed id unchanged when inner already canonical", () => {
    expect(normalizeGooglePreviewModelId("google/gemini-1.5-flash")).toBe("google/gemini-1.5-flash");
  });

  it("normalizeAntigravityPreviewModelId: appends -low to bare pro ids", () => {
    expect(normalizeAntigravityPreviewModelId("gemini-3-pro")).toBe("gemini-3-pro-low");
    expect(normalizeAntigravityPreviewModelId("gemini-3.1-pro")).toBe("gemini-3.1-pro-low");
    expect(normalizeAntigravityPreviewModelId("gemini-3-1-pro")).toBe("gemini-3-1-pro-low");
  });

  it("normalizeAntigravityPreviewModelId: leaves non-pro ids unchanged", () => {
    expect(normalizeAntigravityPreviewModelId("gemini-3-flash")).toBe("gemini-3-flash");
    expect(normalizeAntigravityPreviewModelId("gemini-1.5-pro")).toBe("gemini-1.5-pro");
  });
});

// ---------------------------------------------------------------------------
// provider-enable-config
// ---------------------------------------------------------------------------
import { enablePluginInConfig } from "./provider-enable-config.js";

describe("provider-enable-config", () => {
  it("enables a plugin in an empty config", () => {
    const result = enablePluginInConfig({} as Record<string, unknown>, "my-provider");
    expect(result.enabled).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.config as any).plugins?.entries?.["my-provider"]?.enabled).toBe(true);
  });

  it("returns disabled when plugins.enabled is false", () => {
    const result = enablePluginInConfig({ plugins: { enabled: false } }, "my-provider");
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("plugins disabled");
  });

  it("returns disabled when plugin is in deny list", () => {
    const result = enablePluginInConfig({ plugins: { deny: ["my-provider"] } }, "my-provider");
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("blocked by denylist");
  });

  it("preserves existing plugin entries when enabling a new one", () => {
    const cfg = {
      plugins: {
        entries: { "other-plugin": { enabled: true } },
      },
    };
    const result = enablePluginInConfig(cfg, "my-provider");
    expect(result.enabled).toBe(true);
    expect(result.config.plugins?.entries?.["other-plugin"]?.enabled).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.config as any).plugins?.entries?.["my-provider"]?.enabled).toBe(true);
  });

  it("does not mutate the original config", () => {
    const cfg = { plugins: { entries: {} } };
    enablePluginInConfig(cfg, "my-provider");
    expect(cfg.plugins.entries).not.toHaveProperty("my-provider");
  });
});

// ---------------------------------------------------------------------------
// provider-selection-runtime
// ---------------------------------------------------------------------------
import {
  resolveConfiguredCapabilityProvider,
  resolveProviderRawConfig,
  selectConfiguredOrAutoProvider,
} from "./provider-selection-runtime.js";

type TestProvider = { id: string; autoSelectOrder?: number };

describe("provider-selection-runtime: selectConfiguredOrAutoProvider", () => {
  const providers: TestProvider[] = [
    { id: "alpha", autoSelectOrder: 2 },
    { id: "beta", autoSelectOrder: 1 },
    { id: "gamma", autoSelectOrder: 3 },
  ];

  it("returns the auto-selected provider (lowest autoSelectOrder) when none configured", () => {
    const result = selectConfiguredOrAutoProvider({
      getConfiguredProvider: () => undefined,
      listProviders: () => providers,
    });
    expect(result.missingConfiguredProvider).toBe(false);
    expect(result.provider?.id).toBe("beta");
  });

  it("returns the explicitly configured provider when it exists", () => {
    const result = selectConfiguredOrAutoProvider({
      configuredProviderId: "gamma",
      getConfiguredProvider: (id) => providers.find((p) => p.id === id),
      listProviders: () => providers,
    });
    expect(result.provider?.id).toBe("gamma");
    expect(result.missingConfiguredProvider).toBe(false);
  });

  it("sets missingConfiguredProvider true when configured id not found", () => {
    const result = selectConfiguredOrAutoProvider({
      configuredProviderId: "missing",
      getConfiguredProvider: () => undefined,
      listProviders: () => providers,
    });
    expect(result.missingConfiguredProvider).toBe(true);
    expect(result.provider).toBeUndefined();
  });

  it("returns undefined provider when list is empty and none configured", () => {
    const result = selectConfiguredOrAutoProvider({
      getConfiguredProvider: () => undefined,
      listProviders: () => [],
    });
    expect(result.provider).toBeUndefined();
    expect(result.missingConfiguredProvider).toBe(false);
  });
});

describe("provider-selection-runtime: resolveProviderRawConfig", () => {
  it("returns empty object when no providerConfigs supplied", () => {
    const result = resolveProviderRawConfig({ providerId: "alpha" });
    expect(result).toEqual({});
  });

  it("merges canonical and selected provider configs (selected wins)", () => {
    const result = resolveProviderRawConfig({
      providerId: "alpha",
      configuredProviderId: "beta",
      providerConfigs: {
        alpha: { baseUrl: "https://alpha.example.com", timeout: 30 },
        beta: { timeout: 60 },
      },
    });
    expect(result).toEqual({ baseUrl: "https://alpha.example.com", timeout: 60 });
  });

  it("ignores non-object provider config entries", () => {
    const result = resolveProviderRawConfig({
      providerId: "alpha",
      providerConfigs: { alpha: undefined },
    });
    expect(result).toEqual({});
  });
});

describe("provider-selection-runtime: resolveConfiguredCapabilityProvider", () => {
  type FakeCfg = { apiKey?: string };
  const providers: TestProvider[] = [
    { id: "alpha", autoSelectOrder: 1 },
    { id: "beta", autoSelectOrder: 2 },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function makeParams(overrides: Record<string, any> = {}) {
    return {
      cfg: { apiKey: "key-alpha" } as FakeCfg,
      cfgForResolve: { apiKey: "key-alpha" } as FakeCfg,
      getConfiguredProvider: (id: string | undefined) => providers.find((p) => p.id === id),
      listProviders: () => providers,
      resolveProviderConfig: ({
        rawConfig,
      }: {
        provider: TestProvider;
        cfg: FakeCfg;
        rawConfig: Record<string, unknown>;
      }) => ({ apiKey: (rawConfig["apiKey"] as string) ?? "" }) as FakeCfg,
      isProviderConfigured: ({
        providerConfig,
      }: {
        provider: TestProvider;
        cfg: FakeCfg | undefined;
        providerConfig: FakeCfg;
      }) => Boolean(providerConfig.apiKey),
      ...overrides,
    };
  }

  it("resolves the first auto-configured provider when none explicitly set", () => {
    const result = resolveConfiguredCapabilityProvider(
      makeParams({ providerConfigs: { alpha: { apiKey: "key-alpha" } } }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider.id).toBe("alpha");
    }
  });

  it("returns missing-configured-provider when explicit id not registered", () => {
    const result = resolveConfiguredCapabilityProvider(
      makeParams({ configuredProviderId: "unknown" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("missing-configured-provider");
    }
  });

  it("returns no-registered-provider when provider list is empty", () => {
    const result = resolveConfiguredCapabilityProvider(makeParams({ listProviders: () => [] }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("no-registered-provider");
    }
  });

  it("returns provider-not-configured when no provider has an apiKey", () => {
    const result = resolveConfiguredCapabilityProvider(
      makeParams({
        providerConfigs: {},
        resolveProviderConfig: () => ({ apiKey: "" }),
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("provider-not-configured");
    }
  });
});

// ---------------------------------------------------------------------------
// provider-web-search-contract-fields
// ---------------------------------------------------------------------------
import { createBaseWebSearchProviderContractFields } from "./provider-web-search-contract-fields.js";

describe("provider-web-search-contract-fields: createBaseWebSearchProviderContractFields", () => {
  it("top-level credential: getCredentialValue reads top-level apiKey", () => {
    const fields = createBaseWebSearchProviderContractFields({
      credentialPath: "tools.web.providers.mysearch.apiKey",
      searchCredential: { type: "top-level" },
    });
    const searchConfig = { apiKey: "my-secret" };
    expect(fields.getCredentialValue(searchConfig)).toBe("my-secret");
  });

  it("top-level credential: setCredentialValue writes to top-level", () => {
    const fields = createBaseWebSearchProviderContractFields({
      credentialPath: "tools.web.providers.mysearch.apiKey",
      searchCredential: { type: "top-level" },
    });
    const target: Record<string, unknown> = {};
    fields.setCredentialValue(target, "new-key");
    expect(target["apiKey"]).toBe("new-key");
  });

  it("scoped credential: getCredentialValue reads scoped key", () => {
    const fields = createBaseWebSearchProviderContractFields({
      credentialPath: "tools.web.providers.mysearch.creds.primary",
      searchCredential: { type: "scoped", scopeId: "primary" },
    });
    // getScopedCredentialValue reads searchConfig[scopeId].apiKey (nested)
    const searchConfig = { primary: { apiKey: "scoped-secret" } };
    expect(fields.getCredentialValue(searchConfig)).toBe("scoped-secret");
  });

  it("none credential: getCredentialValue returns undefined", () => {
    const fields = createBaseWebSearchProviderContractFields({
      credentialPath: "",
      searchCredential: { type: "none" },
    });
    expect(fields.getCredentialValue({ apiKey: "ignored" })).toBeUndefined();
  });

  it("inactiveSecretPaths defaults to credentialPath when not supplied", () => {
    const fields = createBaseWebSearchProviderContractFields({
      credentialPath: "tools.web.providers.mysearch.apiKey",
      searchCredential: { type: "none" },
    });
    expect(fields.inactiveSecretPaths).toEqual(["tools.web.providers.mysearch.apiKey"]);
  });

  it("inactiveSecretPaths override is respected", () => {
    const fields = createBaseWebSearchProviderContractFields({
      credentialPath: "tools.web.providers.mysearch.apiKey",
      inactiveSecretPaths: ["custom.path"],
      searchCredential: { type: "none" },
    });
    expect(fields.inactiveSecretPaths).toEqual(["custom.path"]);
  });
});

// ---------------------------------------------------------------------------
// provider-web-search-contract: createWebSearchProviderContractFields
// ---------------------------------------------------------------------------
import { createWebSearchProviderContractFields } from "./provider-web-search-contract.js";

describe("provider-web-search-contract: createWebSearchProviderContractFields", () => {
  it("without selectionPluginId: applySelectionConfig is not set", () => {
    const fields = createWebSearchProviderContractFields({
      credentialPath: "tools.web.providers.mysearch.apiKey",
      searchCredential: { type: "top-level" },
    });
    expect(fields.applySelectionConfig).toBeUndefined();
  });

  it("with selectionPluginId: applySelectionConfig enables the plugin in config", () => {
    const fields = createWebSearchProviderContractFields({
      credentialPath: "tools.web.providers.mysearch.apiKey",
      searchCredential: { type: "top-level" },
      selectionPluginId: "mysearch",
    });
    expect(typeof fields.applySelectionConfig).toBe("function");
    const updated = fields.applySelectionConfig!({});
    expect(updated.plugins?.entries?.["mysearch"]?.enabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// provider-catalog-runtime: re-export smoke tests (import-only)
// ---------------------------------------------------------------------------
import {
  augmentModelCatalogWithProviderPlugins,
  resolveCatalogHookProviderPluginIds,
  resolveOwningPluginIdsForProvider,
  resolvePluginProviders,
} from "./provider-catalog-runtime.js";

describe("provider-catalog-runtime re-exports", () => {
  it("augmentModelCatalogWithProviderPlugins is a function", () => {
    expect(typeof augmentModelCatalogWithProviderPlugins).toBe("function");
  });

  it("resolvePluginProviders is a function", () => {
    expect(typeof resolvePluginProviders).toBe("function");
  });

  it("resolveCatalogHookProviderPluginIds is a function", () => {
    expect(typeof resolveCatalogHookProviderPluginIds).toBe("function");
  });

  it("resolveOwningPluginIdsForProvider is a function", () => {
    expect(typeof resolveOwningPluginIdsForProvider).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// provider-stream-family: re-export smoke test (import-only)
// ---------------------------------------------------------------------------
import * as streamFamily from "./provider-stream-family.js";

describe("provider-stream-family re-exports", () => {
  it("re-exports at least one symbol from provider-stream", () => {
    expect(Object.keys(streamFamily).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// provider-web-fetch: re-export smoke tests
// ---------------------------------------------------------------------------
import {
  DEFAULT_CACHE_TTL_MINUTES,
  DEFAULT_TIMEOUT_SECONDS,
  markdownToText,
  normalizeCacheKey,
  normalizeWhitespace,
  readNumberParam,
  readStringParam,
  truncateText,
  wrapExternalContent,
  wrapWebContent,
} from "./provider-web-fetch.js";

describe("provider-web-fetch re-exports", () => {
  it("markdownToText is a function", () => {
    expect(typeof markdownToText).toBe("function");
  });

  it("normalizeWhitespace collapses whitespace", () => {
    expect(normalizeWhitespace("  hello   world  ")).toBe("hello world");
  });

  it("truncateText is a function", () => {
    expect(typeof truncateText).toBe("function");
  });

  it("readStringParam is a function", () => {
    expect(typeof readStringParam).toBe("function");
  });

  it("readNumberParam is a function", () => {
    expect(typeof readNumberParam).toBe("function");
  });

  it("wrapExternalContent is a function", () => {
    expect(typeof wrapExternalContent).toBe("function");
  });

  it("wrapWebContent is a function", () => {
    expect(typeof wrapWebContent).toBe("function");
  });

  it("DEFAULT_TIMEOUT_SECONDS is a positive number", () => {
    expect(DEFAULT_TIMEOUT_SECONDS).toBeGreaterThan(0);
  });

  it("DEFAULT_CACHE_TTL_MINUTES is a positive number", () => {
    expect(DEFAULT_CACHE_TTL_MINUTES).toBeGreaterThan(0);
  });

  it("normalizeCacheKey is a function", () => {
    expect(typeof normalizeCacheKey).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// provider-web-fetch-contract: re-export smoke test
// ---------------------------------------------------------------------------
import { enablePluginInConfig as enablePluginInConfigFromContract } from "./provider-web-fetch-contract.js";

describe("provider-web-fetch-contract re-exports", () => {
  it("enablePluginInConfig is re-exported and functional", () => {
    expect(typeof enablePluginInConfigFromContract).toBe("function");
    const result = enablePluginInConfigFromContract({}, "test-provider");
    expect(result.enabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// provider-web-search-config-contract: re-export smoke tests
// ---------------------------------------------------------------------------
import {
  createWebSearchProviderContractFields as createWebSearchFieldsFromConfig,
  getScopedCredentialValue,
  getTopLevelCredentialValue,
} from "./provider-web-search-config-contract.js";

describe("provider-web-search-config-contract re-exports", () => {
  it("getTopLevelCredentialValue reads apiKey from searchConfig", () => {
    expect(getTopLevelCredentialValue({ apiKey: "abc" })).toBe("abc");
  });

  it("getScopedCredentialValue reads scoped key", () => {
    // getScopedCredentialValue reads searchConfig[scopeId].apiKey (nested)
    expect(getScopedCredentialValue({ myScope: { apiKey: "val" } }, "myScope")).toBe("val");
  });

  it("createWebSearchProviderContractFields (alias) is a function", () => {
    expect(typeof createWebSearchFieldsFromConfig).toBe("function");
  });
});
