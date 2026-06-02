export type FirecrawlWebFetchProviderTool = {
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

export type FirecrawlWebFetchProviderPlugin = {
  id: string;
  label: string;
  hint: string;
  envVars: string[];
  placeholder: string;
  signupUrl: string;
  docsUrl: string;
  autoDetectOrder: number;
  credentialPath: string;
  inactiveSecretPaths: string[];
  getCredentialValue: (fetchConfig?: Record<string, unknown>) => unknown;
  setCredentialValue: (fetchConfigTarget: Record<string, unknown>, value: unknown) => void;
  getConfiguredCredentialValue?: (config?: {
    plugins?: { entries?: { firecrawl?: { config?: { webFetch?: { apiKey?: unknown } } } } };
  }) => unknown;
  getConfiguredCredentialFallback?: (config?: {
    plugins?: { entries?: { firecrawl?: { config?: { webSearch?: { apiKey?: unknown } } } } };
  }) => { path: string; value: unknown } | undefined;
  setConfiguredCredentialValue?: (configTarget: Record<string, unknown>, value: unknown) => void;
  applySelectionConfig?: (config: Record<string, unknown>) => Record<string, unknown>;
  createTool: (ctx: { config?: Record<string, unknown> }) => FirecrawlWebFetchProviderTool | null;
};

function ensureRecord(target: Record<string, unknown>, key: string): Record<string, unknown> {
  const current = target[key];
  if (current && typeof current === "object" && !Array.isArray(current)) {
    return current as Record<string, unknown>;
  }
  const next: Record<string, unknown> = {};
  target[key] = next;
  return next;
}

export const FIRECRAWL_WEB_FETCH_CREDENTIAL_PATH =
  "plugins.entries.firecrawl.config.webFetch.apiKey";

export const FIRECRAWL_WEB_FETCH_PROVIDER_SHARED = {
  id: "firecrawl",
  label: "Firecrawl",
  hint: "Fetch pages with Firecrawl for JS-heavy or bot-protected sites.",
  envVars: ["FIRECRAWL_API_KEY"],
  placeholder: "fc-...",
  signupUrl: "https://www.firecrawl.dev/",
  docsUrl: "https://docs.firecrawl.dev",
  autoDetectOrder: 50,
  credentialPath: FIRECRAWL_WEB_FETCH_CREDENTIAL_PATH,
  inactiveSecretPaths: [
    FIRECRAWL_WEB_FETCH_CREDENTIAL_PATH,
    "tools.web.fetch.firecrawl.apiKey",
  ],
  getCredentialValue: (fetchConfig) => {
    const legacy = fetchConfig?.firecrawl;
    if (!legacy || typeof legacy !== "object" || Array.isArray(legacy)) {
      return undefined;
    }
    if ((legacy as { enabled?: boolean }).enabled === false) {
      return undefined;
    }
    return (legacy as { apiKey?: unknown }).apiKey;
  },
  setCredentialValue: (fetchConfigTarget, value) => {
    const firecrawl = ensureRecord(fetchConfigTarget, "firecrawl");
    firecrawl.apiKey = value;
  },
  getConfiguredCredentialValue: (config) =>
    config?.plugins?.entries?.firecrawl?.config?.webFetch?.apiKey,
  getConfiguredCredentialFallback: (config) => {
    const apiKey = config?.plugins?.entries?.firecrawl?.config?.webSearch?.apiKey;
    return apiKey === undefined
      ? undefined
      : {
          path: "plugins.entries.firecrawl.config.webSearch.apiKey",
          value: apiKey,
        };
  },
  setConfiguredCredentialValue: (configTarget, value) => {
    const plugins = ensureRecord(configTarget, "plugins");
    const entries = ensureRecord(plugins, "entries");
    const firecrawlEntry = ensureRecord(entries, "firecrawl");
    const pluginConfig = ensureRecord(firecrawlEntry, "config");
    const webFetch = ensureRecord(pluginConfig, "webFetch");
    webFetch.apiKey = value;
  },
} satisfies Omit<
  FirecrawlWebFetchProviderPlugin,
  "applySelectionConfig" | "createTool"
>;
