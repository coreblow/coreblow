import type { SecretInputMode } from "../commands/onboard-types.js";
import type { CoreBlowConfig } from "../config/config.js";
import {
  DEFAULT_SECRET_PROVIDER_ALIAS,
  type SecretInput,
  type SecretRef,
  hasConfiguredSecretInput,
  normalizeSecretInputString,
} from "../config/types.secrets.js";
import {
  listBundledWebSearchProviders,
  resolveBundledWebSearchPluginId,
} from "../plugins/bundled-web-search.js";
import { enablePluginInConfig } from "../plugins/enable.js";
import type { PluginWebSearchProviderEntry } from "../plugins/types.js";
import { resolvePluginWebSearchProviders } from "../plugins/web-search-providers.runtime.js";
import { sortWebSearchProviders } from "../plugins/web-search-providers.shared.js";
import type { RuntimeEnv } from "../runtime.js";
import type { WizardPrompter } from "../wizard/prompts.js";
import type { FlowContribution, FlowOption } from "./types.js";
import { sortFlowContributionsByLabel } from "./types.js";

export type SearchProvider = NonNullable<
  NonNullable<NonNullable<NonNullable<CoreBlowConfig["tools"]>["web"]>["search"]>["provider"]
>;
type SearchConfig = NonNullable<NonNullable<NonNullable<CoreBlowConfig["tools"]>["web"]>["search"]>;
type MutableSearchConfig = SearchConfig & Record<string, unknown>;

export type SearchProviderSetupOption = FlowOption & {
  value: SearchProvider;
};

export type SearchProviderSetupContribution = FlowContribution & {
  kind: "search";
  surface: "setup";
  provider: PluginWebSearchProviderEntry;
  option: SearchProviderSetupOption;
  source: "bundled" | "runtime";
};

function resolveSearchProviderCredentialLabel(
  entry: Pick<PluginWebSearchProviderEntry, "label" | "credentialLabel" | "requiresCredential">,
): string {
  if (entry.requiresCredential === false) {
    return `${entry.label} setup`;
  }
  return entry.credentialLabel?.trim() || `${entry.label} API key`;
}

export const SEARCH_PROVIDER_OPTIONS: readonly PluginWebSearchProviderEntry[] =
  resolveSearchProviderSetupContributions().map((contribution) => contribution.provider);

function showsSearchProviderInSetup(
  entry: Pick<PluginWebSearchProviderEntry, "onboardingScopes">,
): boolean {
  return entry.onboardingScopes?.includes("text-inference") ?? false;
}

function canRepairBundledProviderSelection(
  config: CoreBlowConfig,
  provider: Pick<PluginWebSearchProviderEntry, "id" | "pluginId">,
): boolean {
  const pluginId = provider.pluginId ?? resolveBundledWebSearchPluginId(provider.id);
  if (!pluginId) {
    return false;
  }
  if (config.plugins?.enabled === false) {
    return false;
  }
  return !config.plugins?.deny?.includes(pluginId);
}

export function resolveSearchProviderOptions(
  config?: CoreBlowConfig,
): readonly PluginWebSearchProviderEntry[] {
  return resolveSearchProviderSetupContributions(config).map(
    (contribution) => contribution.provider,
  );
}

function buildSearchProviderSetupContribution(params: {
  provider: PluginWebSearchProviderEntry;
  source: "bundled" | "runtime";
}): SearchProviderSetupContribution {
  return {
    id: `search:setup:${params.provider.id}`,
    kind: "search",
    surface: "setup",
    provider: params.provider,
    option: {
      value: params.provider.id,
      label: params.provider.label,
      ...(params.provider.hint ? { hint: params.provider.hint } : {}),
      ...(params.provider.docsUrl ? { docs: { path: params.provider.docsUrl } } : {}),
    },
    source: params.source,
  };
}

export function resolveSearchProviderSetupContributions(
  config?: CoreBlowConfig,
): SearchProviderSetupContribution[] {
  if (!config) {
    return sortFlowContributionsByLabel(
      sortWebSearchProviders(listBundledWebSearchProviders())
        .filter(showsSearchProviderInSetup)
        .map((provider) => buildSearchProviderSetupContribution({ provider, source: "bundled" })),
    );
  }

  const merged = new Map<string, SearchProviderSetupContribution>(
    resolvePluginWebSearchProviders({
      config,
      bundledAllowlistCompat: true,
      env: process.env,
    }).map((provider) => [
      provider.id,
      buildSearchProviderSetupContribution({ provider, source: "runtime" }),
    ]),
  );

  for (const provider of listBundledWebSearchProviders()) {
    if (merged.has(provider.id) || !canRepairBundledProviderSelection(config, provider)) {
      continue;
    }
    merged.set(provider.id, buildSearchProviderSetupContribution({ provider, source: "bundled" }));
  }

  return sortFlowContributionsByLabel([...merged.values()]);
}

function resolveSearchProviderEntry(
  config: CoreBlowConfig,
  provider: SearchProvider,
): PluginWebSearchProviderEntry | undefined {
  return resolveSearchProviderOptions(config).find((entry) => entry.id === provider);
}

export function hasKeyInEnv(entry: Pick<PluginWebSearchProviderEntry, "envVars">): boolean {
  return entry.envVars.some((k) => Boolean(process.env[k]?.trim()));
}

function providerNeedsCredential(
  entry: Pick<PluginWebSearchProviderEntry, "requiresCredential">,
): boolean {
  return entry.requiresCredential !== false;
}

function providerIsReady(
  config: CoreBlowConfig,
  entry: Pick<PluginWebSearchProviderEntry, "id" | "envVars" | "requiresCredential">,
): boolean {
  if (!providerNeedsCredential(entry)) {
    return true;
  }
  return hasExistingKey(config, entry.id) || hasKeyInEnv(entry);
}

function rawKeyValue(config: CoreBlowConfig, provider: SearchProvider): unknown {
  const search = config.tools?.web?.search;
  const entry = resolveSearchProviderEntry(config, provider);
  return (
    entry?.getConfiguredCredentialValue?.(config) ??
    entry?.getCredentialValue(search as Record<string, unknown> | undefined)
  );
}

export function resolveExistingKey(
  config: CoreBlowConfig,
  provider: SearchProvider,
): string | undefined {
  return normalizeSecretInputString(rawKeyValue(config, provider));
}

export function hasExistingKey(config: CoreBlowConfig, provider: SearchProvider): boolean {
  return hasConfiguredSecretInput(rawKeyValue(config, provider));
}

function buildSearchEnvRef(config: CoreBlowConfig, provider: SearchProvider): SecretRef {
  const entry =
    resolveSearchProviderEntry(config, provider) ??
    SEARCH_PROVIDER_OPTIONS.find((candidate) => candidate.id === provider) ??
    listBundledWebSearchProviders().find((candidate) => candidate.id === provider);
  const envVar = entry?.envVars.find((k) => Boolean(process.env[k]?.trim())) ?? entry?.envVars[0];
  if (!envVar) {
    throw new Error(
      `No env var mapping for search provider "${provider}" at ${entry?.credentialPath ?? "unknown path"} in secret-input-mode=ref.`,
    );
  }
  return { source: "env", provider: DEFAULT_SECRET_PROVIDER_ALIAS, id: envVar };
}

function resolveSearchSecretInput(
  config: CoreBlowConfig,
  provider: SearchProvider,
  key: string,
  secretInputMode?: SecretInputMode,
): SecretInput {
  const useSecretRefMode = secretInputMode === "ref"; // pragma: allowlist secret
  if (useSecretRefMode) {
    return buildSearchEnvRef(config, provider);
  }
  return key;
}

export function applySearchKey(
  config: CoreBlowConfig,
  provider: SearchProvider,
  key: SecretInput,
): CoreBlowConfig {
  const providerEntry = resolveSearchProviderEntry(config, provider);
  if (!providerEntry) {
    return config;
  }
  const search: MutableSearchConfig = { ...config.tools?.web?.search, provider, enabled: true };
  if (!providerEntry.setConfiguredCredentialValue) {
    providerEntry.setCredentialValue(search, key);
  }
  const nextBase: CoreBlowConfig = {
    ...config,
    tools: {
      ...config.tools,
      web: { ...config.tools?.web, search },
    },
  };
  const next = applySearchProviderSelectionConfig(nextBase, providerEntry);
  providerEntry.setConfiguredCredentialValue?.(next, key);
  return next;
}

function applySearchProviderSelectionConfig(
  config: CoreBlowConfig,
  providerEntry: Pick<PluginWebSearchProviderEntry, "pluginId" | "applySelectionConfig">,
): CoreBlowConfig {
  if (providerEntry.applySelectionConfig) {
    return providerEntry.applySelectionConfig(config);
  }
  if (providerEntry.pluginId) {
    return enablePluginInConfig(config, providerEntry.pluginId).config;
  }
  return config;
}

export function applySearchProviderSelection(
  config: CoreBlowConfig,
  provider: SearchProvider,
): CoreBlowConfig {
  const providerEntry = resolveSearchProviderEntry(config, provider);
  if (!providerEntry) {
    return config;
  }
  const search: MutableSearchConfig = {
    ...config.tools?.web?.search,
    provider,
    enabled: true,
  };
  const nextBase: CoreBlowConfig = {
    ...config,
    tools: {
      ...config.tools,
      web: {
        ...config.tools?.web,
        search,
      },
    },
  };
  return applySearchProviderSelectionConfig(nextBase, providerEntry);
}

function preserveDisabledState(original: CoreBlowConfig, result: CoreBlowConfig): CoreBlowConfig {
  if (original.tools?.web?.search?.enabled !== false) {
    return result;
  }

  const next: CoreBlowConfig = {
    ...result,
    tools: {
      ...result.tools,
      web: { ...result.tools?.web, search: { ...result.tools?.web?.search, enabled: false } },
    },
  };

  const provider = next.tools?.web?.search?.provider;
  if (typeof provider !== "string") {
    return next;
  }
  const providerEntry = resolveSearchProviderEntry(original, provider);
  if (!providerEntry?.pluginId) {
    return next;
  }

  const pluginId = providerEntry.pluginId;
  const originalPluginEntry = (
    original.plugins?.entries as Record<string, Record<string, unknown>> | undefined
  )?.[pluginId];
  const resultPluginEntry = (
    next.plugins?.entries as Record<string, Record<string, unknown>> | undefined
  )?.[pluginId];

  const nextPlugins = { ...next.plugins } as Record<string, unknown>;

  if (Array.isArray(original.plugins?.allow)) {
    nextPlugins.allow = [...original.plugins.allow];
  } else {
    delete nextPlugins.allow;
  }

  if (resultPluginEntry || originalPluginEntry) {
    const nextEntries = {
      ...(nextPlugins.entries as Record<string, Record<string, unknown>> | undefined),
    };
    const patchedEntry = { ...resultPluginEntry };
    if (typeof originalPluginEntry?.enabled === "boolean") {
      patchedEntry.enabled = originalPluginEntry.enabled;
    } else {
      delete patchedEntry.enabled;
    }
    nextEntries[pluginId] = patchedEntry;
    nextPlugins.entries = nextEntries;
  }

  return {
    ...next,
    plugins: nextPlugins as CoreBlowConfig["plugins"],
  };
}

export type SetupSearchOptions = {
  quickstartDefaults?: boolean;
  secretInputMode?: SecretInputMode;
};

export async function runSearchSetupFlow(
  config: CoreBlowConfig,
  _runtime: RuntimeEnv,
  prompter: WizardPrompter,
  opts?: SetupSearchOptions,
): Promise<CoreBlowConfig> {
  const providerOptions = resolveSearchProviderOptions(config);
  if (providerOptions.length === 0) {
    await prompter.note(
      [
        "No web search providers are currently available under this plugin policy.",
        "Enable plugins or remove deny rules, then run setup again.",
        "Docs: https://docs.coreblow.com/tools/web",
      ].join("\n"),
      "Web search",
    );
    return config;
  }

  await prompter.note(
    [
      "Web search lets your agent look things up online.",
      "Choose a provider. Some providers need an API key, and some work key-free.",
      "Docs: https://docs.coreblow.com/tools/web",
    ].join("\n"),
    "Web search",
  );

  const existingProvider = config.tools?.web?.search?.provider;

  const options = providerOptions.map((entry) => {
    const hint =
      entry.requiresCredential === false
        ? `${entry.hint} · key-free`
        : providerIsReady(config, entry)
          ? `${entry.hint} · configured`
          : entry.hint;
    return { value: entry.id, label: entry.label, hint };
  });

  const defaultProvider: SearchProvider = (() => {
    if (existingProvider && providerOptions.some((entry) => entry.id === existingProvider)) {
      return existingProvider;
    }
    const detected = providerOptions.find((entry) => providerIsReady(config, entry));
    if (detected) {
      return detected.id;
    }
    return providerOptions[0].id;
  })();

  const choice = await prompter.select({
    message: "Search provider",
    options: [
      ...options,
      {
        value: "__skip__" as const,
        label: "Skip for now",
        hint: "Configure later with coreblow configure --section web",
      },
    ],
    initialValue: defaultProvider,
  });

  if (choice === "__skip__") {
    return config;
  }

  const entry =
    resolveSearchProviderEntry(config, choice) ?? providerOptions.find((e) => e.id === choice);
  if (!entry) {
    return config;
  }
  const credentialLabel = resolveSearchProviderCredentialLabel(entry);
  const existingKey = resolveExistingKey(config, choice);
  const keyConfigured = hasExistingKey(config, choice);
  const envAvailable = hasKeyInEnv(entry);
  const needsCredential = providerNeedsCredential(entry);

  if (opts?.quickstartDefaults && (keyConfigured || envAvailable)) {
    const result = existingKey
      ? applySearchKey(config, choice, existingKey)
      : applySearchProviderSelection(config, choice);
    return preserveDisabledState(config, result);
  }

  if (!needsCredential) {
    await prompter.note(
      [
        `${entry.label} works without an API key.`,
        "CoreBlow will enable the plugin and use it as your web_search provider.",
        `Docs: ${entry.docsUrl ?? "https://docs.coreblow.com/tools/web"}`,
      ].join("\n"),
      "Web search",
    );
    return preserveDisabledState(config, applySearchProviderSelection(config, choice));
  }

  const useSecretRefMode = opts?.secretInputMode === "ref"; // pragma: allowlist secret
  if (useSecretRefMode) {
    if (keyConfigured) {
      return preserveDisabledState(config, applySearchProviderSelection(config, choice));
    }
    const ref = buildSearchEnvRef(config, choice);
    await prompter.note(
      [
        "Secret references enabled — CoreBlow will store a reference instead of the API key.",
        `Env var: ${ref.id}${envAvailable ? " (detected)" : ""}.`,
        ...(envAvailable ? [] : [`Set ${ref.id} in the Gateway environment.`]),
        "Docs: https://docs.coreblow.com/tools/web",
      ].join("\n"),
      "Web search",
    );
    return applySearchKey(config, choice, ref);
  }

  const keyInput = await prompter.text({
    message: keyConfigured
      ? `${credentialLabel} (leave blank to keep current)`
      : envAvailable
        ? `${credentialLabel} (leave blank to use env var)`
        : credentialLabel,
    placeholder: keyConfigured ? "Leave blank to keep current" : entry.placeholder,
  });

  const key = keyInput?.trim() ?? "";
  if (key) {
    const secretInput = resolveSearchSecretInput(config, choice, key, opts?.secretInputMode);
    return applySearchKey(config, choice, secretInput);
  }

  if (existingKey) {
    return preserveDisabledState(config, applySearchKey(config, choice, existingKey));
  }

  if (keyConfigured || envAvailable) {
    return preserveDisabledState(config, applySearchProviderSelection(config, choice));
  }

  await prompter.note(
    [
      `No ${credentialLabel} stored — web_search won't work until a key is available.`,
      `Get your key at: ${entry.signupUrl}`,
      "Docs: https://docs.coreblow.com/tools/web",
    ].join("\n"),
    "Web search",
  );

  const search: SearchConfig = {
    ...config.tools?.web?.search,
    provider: choice,
  };
  return {
    ...config,
    tools: {
      ...config.tools,
      web: {
        ...config.tools?.web,
        search,
      },
    },
  };
}
