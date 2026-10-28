import type { Api, Model } from "@mariozechner/pi-ai";
import type { ModelRegistry } from "@mariozechner/pi-coding-agent";
import type { AuthProfileStore } from "../../agents/auth-profiles.js";
import { DEFAULT_CONTEXT_TOKENS } from "../../agents/defaults.js";
import { loadModelCatalog } from "../../agents/model-catalog.js";
import { shouldSuppressBuiltInModel } from "../../agents/model-suppression.js";
import { resolveModelWithRegistry } from "../../agents/pi-embedded-runner/model.js";
import { normalizeProviderId } from "../../agents/provider-id.js";
import type { ModelDefinitionConfig, ModelProviderConfig } from "../../config/types.models.js";
import type { CoreBlowConfig } from "../../config/types.coreblow.js";
import type { NormalizedModelCatalogRow } from "../../model-catalog/index.js";
import type { PluginMetadataSnapshot } from "../../plugins/plugin-metadata-snapshot.types.js";
import { createLazyImportLoader } from "../../shared/lazy-promise.js";
import type { ModelListAuthIndex } from "./list.auth-index.js";
import { loadModelRegistry, toModelRow } from "./list.registry.js";
import type { ConfiguredEntry, ModelRow } from "./list.types.js";
import { isLocalBaseUrl, modelKey } from "./shared.js";

export { loadListModelRegistry } from "./list.registry-load.js";

type ConfiguredByKey = Map<string, ConfiguredEntry>;
type ProviderCatalogModule = typeof import("./list.provider-catalog.js");

type RowFilter = {
  provider?: string;
  local?: boolean;
};

export type RowBuilderContext = {
  cfg: CoreBlowConfig;
  authStore?: AuthProfileStore;
  agentDir?: string;
  authIndex?: ModelListAuthIndex;
  availableKeys?: Set<string>;
  configuredByKey: ConfiguredByKey;
  discoveredKeys: Set<string>;
  filter: RowFilter;
  skipRuntimeModelSuppression?: boolean;
  metadataSnapshot?: PluginMetadataSnapshot;
};

const providerCatalogModuleLoader = createLazyImportLoader<ProviderCatalogModule>(
  () => import("./list.provider-catalog.js"),
);

function loadProviderCatalogModule(): Promise<ProviderCatalogModule> {
  return providerCatalogModuleLoader.load();
}

function matchesRowFilter(filter: RowFilter, model: { provider: string; baseUrl?: string }) {
  if (filter.provider && normalizeProviderId(model.provider) !== filter.provider) {
    return false;
  }
  if (filter.local && !isLocalBaseUrl(model.baseUrl ?? "")) {
    return false;
  }
  return true;
}

function buildRow(params: {
  model: Model<Api>;
  key: string;
  context: RowBuilderContext;
  allowProviderAvailabilityFallback?: boolean;
}): ModelRow {
  const configured = params.context.configuredByKey.get(params.key);
  const allowProviderAvailabilityFallback =
    params.allowProviderAvailabilityFallback === true ||
    (configured !== undefined &&
      (params.context.authIndex?.allowsProviderAuthAvailabilityFallback(params.model.provider) ??
        false));
  return toModelRow({
    model: params.model,
    key: params.key,
    tags: configured ? Array.from(configured.tags) : [],
    aliases: configured?.aliases ?? [],
    availableKeys: params.context.availableKeys,
    cfg: params.context.cfg,
    authStore: params.context.authStore,
    allowProviderAvailabilityFallback,
  });
}

function appendVisibleRow(params: {
  rows: ModelRow[];
  model: Model<Api>;
  key: string;
  context: RowBuilderContext;
  seenKeys?: Set<string>;
  allowProviderAvailabilityFallback?: boolean;
  skipSuppression?: boolean;
}): boolean {
  if (params.seenKeys?.has(params.key)) {
    return false;
  }
  if (!matchesRowFilter(params.context.filter, params.model)) {
    return false;
  }
  if (
    !params.skipSuppression &&
    shouldSuppressBuiltInModel({ provider: params.model.provider, id: params.model.id })
  ) {
    return false;
  }
  params.rows.push(
    buildRow({
      model: params.model,
      key: params.key,
      context: params.context,
      allowProviderAvailabilityFallback: params.allowProviderAvailabilityFallback,
    }),
  );
  params.seenKeys?.add(params.key);
  return true;
}

function toConfiguredProviderListModel(params: {
  provider: string;
  providerConfig: Partial<ModelProviderConfig>;
  model: Partial<ModelDefinitionConfig> & Pick<ModelDefinitionConfig, "id">;
}): Model<Api> {
  return {
    provider: params.provider,
    id: params.model.id,
    name: params.model.name ?? params.model.id,
    api: params.model.api ?? (params.providerConfig.baseUrl ? "openai-completions" : "openai-responses"),
    baseUrl: (params.model as { baseUrl?: string }).baseUrl ?? params.providerConfig.baseUrl,
    input: params.model.input ?? ["text"],
    contextWindow: params.model.contextWindow ?? DEFAULT_CONTEXT_TOKENS,
    maxTokens: params.model.maxTokens ?? 8192,
    cost: params.model.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  } as Model<Api>;
}

function toManifestCatalogListModel(
  row: Pick<NormalizedModelCatalogRow, "provider" | "id" | "name" | "baseUrl" | "contextWindow"> & {
    input?: readonly string[];
  },
): Model<Api> {
  return {
    provider: row.provider,
    id: row.id,
    name: row.name,
    api: "openai-responses",
    baseUrl: row.baseUrl,
    input: (row.input?.length ? row.input : ["text"]) as Array<"text" | "image">,
    contextWindow: row.contextWindow ?? DEFAULT_CONTEXT_TOKENS,
    maxTokens: 8192,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  } as Model<Api>;
}

export function appendDiscoveredRows(params: {
  rows: ModelRow[];
  models: Model<Api>[];
  modelRegistry?: ModelRegistry;
  context: RowBuilderContext;
  resolveWithRegistry?: boolean;
  skipSuppression?: boolean;
}): Set<string> {
  const seenKeys = new Set<string>();
  const sorted = [...params.models].toSorted((a, b) => {
    const providerCompare = a.provider.localeCompare(b.provider);
    if (providerCompare !== 0) {
      return providerCompare;
    }
    return a.id.localeCompare(b.id);
  });

  for (const model of sorted) {
    const key = modelKey(model.provider, model.id);
    appendVisibleRow({
      rows: params.rows,
      model,
      key,
      context: params.context,
      seenKeys,
      skipSuppression: params.skipSuppression,
    });
  }

  return seenKeys;
}

export function appendConfiguredProviderRows(params: {
  rows: ModelRow[];
  context: RowBuilderContext;
  seenKeys: Set<string>;
}): void {
  for (const [provider, providerConfig] of Object.entries(
    params.context.cfg.models?.providers ?? {},
  )) {
    for (const configuredModel of providerConfig.models ?? []) {
      const key = modelKey(provider, configuredModel.id);
      const model = toConfiguredProviderListModel({
        provider,
        providerConfig,
        model: configuredModel,
      });
      appendVisibleRow({
        rows: params.rows,
        model,
        key,
        context: params.context,
        seenKeys: params.seenKeys,
        allowProviderAvailabilityFallback: !params.context.discoveredKeys.has(key),
      });
    }
  }
}

export async function appendAuthenticatedCatalogRows(params: {
  rows: ModelRow[];
  context: RowBuilderContext;
  seenKeys: Set<string>;
}): Promise<void> {
  const catalog = await loadModelCatalog({
    config: params.context.cfg,
    readOnly: true,
  });
  for (const entry of catalog) {
    if (params.context.authIndex && !params.context.authIndex.hasProviderAuth(entry.provider)) {
      continue;
    }
    const key = modelKey(entry.provider, entry.id);
    appendVisibleRow({
      rows: params.rows,
      model: toManifestCatalogListModel(entry),
      key,
      context: params.context,
      seenKeys: params.seenKeys,
      allowProviderAvailabilityFallback: true,
    });
  }
}

export function appendModelCatalogRows(params: {
  rows: ModelRow[];
  context: RowBuilderContext;
  seenKeys: Set<string>;
  catalogRows: readonly NormalizedModelCatalogRow[];
}): number {
  let appended = 0;
  for (const catalogRow of params.catalogRows) {
    const key = modelKey(catalogRow.provider, catalogRow.id);
    if (
      appendVisibleRow({
        rows: params.rows,
        model: toManifestCatalogListModel(catalogRow),
        key,
        context: params.context,
        seenKeys: params.seenKeys,
        allowProviderAvailabilityFallback: true,
      })
    ) {
      appended += 1;
    }
  }
  return appended;
}

export function appendManifestCatalogRows(params: {
  rows: ModelRow[];
  context: RowBuilderContext;
  seenKeys: Set<string>;
  manifestRows: readonly NormalizedModelCatalogRow[];
}): number {
  return appendModelCatalogRows({
    ...params,
    catalogRows: params.manifestRows,
  });
}

export async function appendCatalogSupplementRows(params: {
  rows: ModelRow[];
  modelRegistry: ModelRegistry;
  context: RowBuilderContext;
  seenKeys: Set<string>;
}): Promise<void> {
  const catalog = await loadModelCatalog({ config: params.context.cfg });
  for (const entry of catalog) {
    if (
      params.context.filter.provider &&
      normalizeProviderId(entry.provider) !== params.context.filter.provider
    ) {
      continue;
    }
    const key = modelKey(entry.provider, entry.id);
    if (params.seenKeys.has(key)) {
      continue;
    }
    const model = resolveModelWithRegistry({
      provider: entry.provider,
      modelId: entry.id,
      modelRegistry: params.modelRegistry,
      cfg: params.context.cfg,
    });
    if (!model || !matchesRowFilter(params.context.filter, model)) {
      continue;
    }
    params.rows.push(
      buildRow({
        model,
        key,
        context: params.context,
        allowProviderAvailabilityFallback: !params.context.discoveredKeys.has(key),
      }),
    );
    params.seenKeys.add(key);
  }
}

export async function appendProviderCatalogRows(params: {
  rows: ModelRow[];
  context: RowBuilderContext;
  seenKeys: Set<string>;
  staticOnly?: boolean;
}): Promise<number> {
  let appended = 0;
  const { loadProviderCatalogModelsForList } = await loadProviderCatalogModule();
  for (const model of await loadProviderCatalogModelsForList({
    cfg: params.context.cfg,
    agentDir: params.context.agentDir ?? "",
    providerFilter: params.context.filter.provider,
    staticOnly: params.staticOnly,
    metadataSnapshot: params.context.metadataSnapshot,
  })) {
    const key = modelKey(model.provider, model.id);
    if (
      appendVisibleRow({
        rows: params.rows,
        model,
        key,
        context: params.context,
        seenKeys: params.seenKeys,
        allowProviderAvailabilityFallback: !params.context.discoveredKeys.has(key),
      })
    ) {
      appended += 1;
    }
  }
  return appended;
}

export function appendConfiguredRows(params: {
  rows: ModelRow[];
  entries: ConfiguredEntry[];
  modelRegistry?: ModelRegistry;
  context: RowBuilderContext;
}): void {
  for (const entry of params.entries) {
    if (
      params.context.filter.provider &&
      normalizeProviderId(entry.ref.provider) !== params.context.filter.provider
    ) {
      continue;
    }
    const model = params.modelRegistry
      ? resolveModelWithRegistry({
          provider: entry.ref.provider,
          modelId: entry.ref.model,
          modelRegistry: params.modelRegistry,
          cfg: params.context.cfg,
        })
      : undefined;
    if (params.context.filter.local && model && !isLocalBaseUrl(model.baseUrl ?? "")) {
      continue;
    }
    if (params.context.filter.local && !model) {
      continue;
    }
    params.rows.push(
      toModelRow({
        model,
        key: entry.key,
        tags: Array.from(entry.tags),
        aliases: entry.aliases,
        availableKeys: params.context.availableKeys,
        cfg: params.context.cfg,
        authStore: params.context.authStore,
        allowProviderAvailabilityFallback: model
          ? !params.context.discoveredKeys.has(modelKey(model.provider, model.id))
          : false,
      }),
    );
  }
}
