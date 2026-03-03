import { type CoreBlowConfig, loadConfig } from "../config/config.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { augmentModelCatalogWithProviderPlugins } from "../plugins/provider-runtime.runtime.js";
import { resolveCoreBlowAgentDir } from "./agent-paths.js";
import { ensureCoreBlowModelsJson } from "./models-config.js";
import { normalizeProviderId } from "./provider-id.js";

const log = createSubsystemLogger("model-catalog");

export type ModelInputType = "text" | "image" | "document";

export type ModelCatalogEntry = {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
  input?: ModelInputType[];
};

type DiscoveredModel = {
  id: string;
  name?: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
  input?: ModelInputType[];
};

type PiSdkModule = typeof import("./pi-model-discovery.js");

let modelCatalogPromise: Promise<ModelCatalogEntry[]> | null = null;
let hasLoggedModelCatalogError = false;
const defaultImportPiSdk = () => import("./pi-model-discovery-runtime.js");
let importPiSdk = defaultImportPiSdk;
let modelSuppressionPromise: Promise<typeof import("./model-suppression.runtime.js")> | undefined;

const NON_PI_NATIVE_MODEL_PROVIDERS = new Set(["deepseek", "kilocode"]);

// Inline fallback: providers where gpt-5.3-codex-spark should be suppressed.
// Mirrors extensions/openai/openai-provider.ts SUPPRESSED_SPARK_PROVIDERS.
const INLINE_SUPPRESSED_SPARK_PROVIDERS = new Set(["openai", "azure-openai-responses"]);

function shouldLogModelCatalogTiming(): boolean {
  return process.env.COREBLOW_DEBUG_INGRESS_TIMING === "1";
}

function loadModelSuppression() {
  modelSuppressionPromise ??= import("./model-suppression.runtime.js");
  return modelSuppressionPromise;
}

function normalizeConfiguredModelInput(input: unknown): ModelInputType[] | undefined {
  if (!Array.isArray(input)) {
    return undefined;
  }
  const normalized = input.filter(
    (item): item is ModelInputType => item === "text" || item === "image" || item === "document",
  );
  return normalized.length > 0 ? normalized : undefined;
}

function readConfiguredOptInProviderModels(config: CoreBlowConfig): ModelCatalogEntry[] {
  const providers = config.models?.providers;
  if (!providers || typeof providers !== "object") {
    return [];
  }

  const out: ModelCatalogEntry[] = [];
  for (const [providerRaw, providerValue] of Object.entries(providers)) {
    const provider = providerRaw.toLowerCase().trim();
    if (!NON_PI_NATIVE_MODEL_PROVIDERS.has(provider)) {
      continue;
    }
    if (!providerValue || typeof providerValue !== "object") {
      continue;
    }

    const configuredModels = (providerValue as { models?: unknown }).models;
    if (!Array.isArray(configuredModels)) {
      continue;
    }

    for (const configuredModel of configuredModels) {
      if (!configuredModel || typeof configuredModel !== "object") {
        continue;
      }
      const idRaw = (configuredModel as { id?: unknown }).id;
      if (typeof idRaw !== "string") {
        continue;
      }
      const id = idRaw.trim();
      if (!id) {
        continue;
      }
      const rawName = (configuredModel as { name?: unknown }).name;
      const name = (typeof rawName === "string" ? rawName : id).trim() || id;
      const contextWindowRaw = (configuredModel as { contextWindow?: unknown }).contextWindow;
      const contextWindow =
        typeof contextWindowRaw === "number" && contextWindowRaw > 0 ? contextWindowRaw : undefined;
      const reasoningRaw = (configuredModel as { reasoning?: unknown }).reasoning;
      const reasoning = typeof reasoningRaw === "boolean" ? reasoningRaw : undefined;
      const input = normalizeConfiguredModelInput((configuredModel as { input?: unknown }).input);
      out.push({ id, name, provider, contextWindow, reasoning, input });
    }
  }

  return out;
}

function mergeConfiguredOptInProviderModels(params: {
  config: CoreBlowConfig;
  models: ModelCatalogEntry[];
}): void {
  const configured = readConfiguredOptInProviderModels(params.config);
  if (configured.length === 0) {
    return;
  }

  const seen = new Set(
    params.models.map(
      (entry) => `${entry.provider.toLowerCase().trim()}::${entry.id.toLowerCase().trim()}`,
    ),
  );

  for (const entry of configured) {
    const key = `${entry.provider.toLowerCase().trim()}::${entry.id.toLowerCase().trim()}`;
    if (seen.has(key)) {
      continue;
    }
    params.models.push(entry);
    seen.add(key);
  }
}

export function resetModelCatalogCacheForTest() {
  modelCatalogPromise = null;
  hasLoggedModelCatalogError = false;
  importPiSdk = defaultImportPiSdk;
}

// Test-only escape hatch: allow mocking the dynamic import to simulate transient failures.
export function __setModelCatalogImportForTest(loader?: () => Promise<PiSdkModule>) {
  importPiSdk = loader ?? defaultImportPiSdk;
}

export async function loadModelCatalog(params?: {
  config?: CoreBlowConfig;
  useCache?: boolean;
}): Promise<ModelCatalogEntry[]> {
  if (params?.useCache === false) {
    modelCatalogPromise = null;
  }
  if (modelCatalogPromise) {
    return modelCatalogPromise;
  }

  modelCatalogPromise = (async () => {
    const models: ModelCatalogEntry[] = [];
    const timingEnabled = shouldLogModelCatalogTiming();
    const startMs = timingEnabled ? Date.now() : 0;
    const logStage = (stage: string, extra?: string) => {
      if (!timingEnabled) {
        return;
      }
      const suffix = extra ? ` ${extra}` : "";
      log.info(`model-catalog stage=${stage} elapsedMs=${Date.now() - startMs}${suffix}`);
    };
    const sortModels = (entries: ModelCatalogEntry[]) =>
      entries.sort((a, b) => {
        const p = a.provider.localeCompare(b.provider);
        if (p !== 0) {
          return p;
        }
        return a.name.localeCompare(b.name);
      });
    try {
      const cfg = params?.config ?? loadConfig();
      await ensureCoreBlowModelsJson(cfg);
      logStage("models-json-ready");
      // IMPORTANT: keep the dynamic import *inside* the try/catch.
      // If this fails once (e.g. during a pnpm install that temporarily swaps node_modules),
      // we must not poison the cache with a rejected promise (otherwise all channel handlers
      // will keep failing until restart).
      const piSdk = await importPiSdk();
      logStage("pi-sdk-imported");
      const agentDir = resolveCoreBlowAgentDir();
      const { shouldSuppressBuiltInModel } = await loadModelSuppression();
      logStage("catalog-deps-ready");
      const { join } = await import("node:path");
      const authStorage = piSdk.discoverAuthStorage(agentDir);
      logStage("auth-storage-ready");
      const registry = new (piSdk.ModelRegistry as unknown as {
        new (
          authStorage: unknown,
          modelsFile: string,
        ):
          | Array<DiscoveredModel>
          | {
              getAll: () => Array<DiscoveredModel>;
            };
      })(authStorage, join(agentDir, "models.json"));
      logStage("registry-ready");
      const entries = Array.isArray(registry) ? registry : registry.getAll();
      logStage("registry-read", `entries=${entries.length}`);
      for (const entry of entries) {
        const id = String(entry?.id ?? "").trim();
        if (!id) {
          continue;
        }
        const provider = String(entry?.provider ?? "").trim();
        if (!provider) {
          continue;
        }
        if (shouldSuppressBuiltInModel({ provider, id })) {
          continue;
        }
        // Inline fallback suppression: codex-spark is only valid on openai-codex.
        // When the OpenAI plugin can't load, replicate its suppressBuiltInModel hook.
        if (
          id.toLowerCase() === "gpt-5.3-codex-spark" &&
          INLINE_SUPPRESSED_SPARK_PROVIDERS.has(normalizeProviderId(provider))
        ) {
          continue;
        }
        const name = String(entry?.name ?? id).trim() || id;
        const contextWindow =
          typeof entry?.contextWindow === "number" && entry.contextWindow > 0
            ? entry.contextWindow
            : undefined;
        const reasoning = typeof entry?.reasoning === "boolean" ? entry.reasoning : undefined;
        const input = Array.isArray(entry?.input) ? entry.input : undefined;
        models.push({ id, name, provider, contextWindow, reasoning, input });
      }
      mergeConfiguredOptInProviderModels({ config: cfg, models });
      logStage("configured-models-merged", `entries=${models.length}`);
      // Inline fallback augmentation runs first: its codex-spark template lookup
      // includes gpt-5.4 (producing correct reasoning/contextWindow inheritance).
      // The native plugin uses a narrower template set, so inline takes priority.
      const inlineAugmented = applyInlineOpenAICatalogAugmentations(models);
      const supplemental = await augmentModelCatalogWithProviderPlugins({
        config: cfg,
        env: process.env,
        context: {
          config: cfg,
          agentDir,
          env: process.env,
          entries: [...models],
        },
      });
      // Inline first, then plugin — dedup keeps the first occurrence.
      const allAugmented = [...inlineAugmented, ...supplemental];
      if (allAugmented.length > 0) {
        const seen = new Set(
          models.map(
            (entry) => `${entry.provider.toLowerCase().trim()}::${entry.id.toLowerCase().trim()}`,
          ),
        );
        for (const entry of allAugmented) {
          const key = `${entry.provider.toLowerCase().trim()}::${entry.id.toLowerCase().trim()}`;
          if (seen.has(key)) {
            continue;
          }
          models.push(entry);
          seen.add(key);
        }
      }
      logStage("plugin-models-merged", `entries=${models.length}`);

      if (models.length === 0) {
        // If we found nothing, don't cache this result so we can try again.
        modelCatalogPromise = null;
      }

      const sorted = sortModels(models);
      logStage("complete", `entries=${sorted.length}`);
      return sorted;
    } catch (error) {
      if (!hasLoggedModelCatalogError) {
        hasLoggedModelCatalogError = true;
        log.warn(`Failed to load model catalog: ${String(error)}`);
      }
      // Don't poison the cache on transient dependency/filesystem issues.
      modelCatalogPromise = null;
      if (models.length > 0) {
        return sortModels(models);
      }
      return [];
    }
  })();

  return modelCatalogPromise;
}

/**
 * Check if a model supports image input based on its catalog entry.
 */
export function modelSupportsVision(entry: ModelCatalogEntry | undefined): boolean {
  return entry?.input?.includes("image") ?? false;
}

/**
 * Check if a model supports native document/PDF input based on its catalog entry.
 */
export function modelSupportsDocument(entry: ModelCatalogEntry | undefined): boolean {
  return entry?.input?.includes("document") ?? false;
}

/**
 * Find a model in the catalog by provider and model ID.
 */
export function findModelInCatalog(
  catalog: ModelCatalogEntry[],
  provider: string,
  modelId: string,
): ModelCatalogEntry | undefined {
  const normalizedProvider = normalizeProviderId(provider);
  const normalizedModelId = modelId.toLowerCase().trim();
  return catalog.find(
    (entry) =>
      normalizeProviderId(entry.provider) === normalizedProvider &&
      entry.id.toLowerCase() === normalizedModelId,
  );
}
// ---------------------------------------------------------------------------
// Inline OpenAI catalog augmentation fallback
// ---------------------------------------------------------------------------
// When the Jiti plugin system fails to load extensions (e.g. missing
// @mariozechner/pi-ai in test), this replicates the augmentModelCatalog
// hooks from extensions/openai/openai-codex-provider.ts and
// extensions/openai/openai-provider.ts.

function findInlineCatalogTemplate(
  entries: ReadonlyArray<{ provider: string; id: string }>,
  providerId: string,
  templateIds: readonly string[],
) {
  return templateIds
    .map((templateId) =>
      entries.find(
        (entry) =>
          normalizeProviderId(entry.provider) === normalizeProviderId(providerId) &&
          entry.id.toLowerCase() === templateId.toLowerCase(),
      ),
    )
    .find((entry) => entry !== undefined);
}

function applyInlineOpenAICatalogAugmentations(
  entries: ModelCatalogEntry[],
): ModelCatalogEntry[] {
  const result: ModelCatalogEntry[] = [];
  const existingIds = new Set(
    entries.map(
      (e) => `${normalizeProviderId(e.provider)}::${e.id.toLowerCase()}`,
    ),
  );

  // --- openai-codex augmentations (from openai-codex-provider.ts) ---
  const CODEX_PROVIDER = "openai-codex";
  const CODEX_GPT_54_TEMPLATE_IDS = ["gpt-5.3-codex", "gpt-5.2-codex"] as const;
  const CODEX_SPARK_TEMPLATE_IDS = ["gpt-5.4", "gpt-5.3-codex", "gpt-5.2-codex"] as const;

  // gpt-5.4 on openai-codex (forward-compat from gpt-5.3-codex or gpt-5.2-codex)
  const codexGpt54Template = findInlineCatalogTemplate(
    entries, CODEX_PROVIDER, CODEX_GPT_54_TEMPLATE_IDS,
  );
  if (codexGpt54Template && !existingIds.has(`${normalizeProviderId(CODEX_PROVIDER)}::gpt-5.4`)) {
    result.push({
      ...codexGpt54Template,
      id: "gpt-5.4",
      name: "gpt-5.4",
    });
  }

  // gpt-5.3-codex-spark on openai-codex (synthesis from codex templates)
  const codexSparkTemplate = findInlineCatalogTemplate(
    entries, CODEX_PROVIDER, CODEX_SPARK_TEMPLATE_IDS,
  );
  if (
    codexSparkTemplate &&
    !existingIds.has(`${normalizeProviderId(CODEX_PROVIDER)}::gpt-5.3-codex-spark`)
  ) {
    result.push({
      ...codexSparkTemplate,
      id: "gpt-5.3-codex-spark",
      name: "gpt-5.3-codex-spark",
    });
  }

  // --- openai augmentations (from openai-provider.ts) ---
  const OPENAI_PROVIDER = "openai";
  const GPT_54_TEMPLATES = ["gpt-5.2"] as const;
  const GPT_54_PRO_TEMPLATES = ["gpt-5.2-pro", "gpt-5.2"] as const;
  const GPT_54_MINI_TEMPLATES = ["gpt-5-mini"] as const;
  const GPT_54_NANO_TEMPLATES = ["gpt-5-nano", "gpt-5-mini"] as const;

  const forwardCompatModels: Array<{ id: string; templates: readonly string[] }> = [
    { id: "gpt-5.4", templates: GPT_54_TEMPLATES },
    { id: "gpt-5.4-pro", templates: GPT_54_PRO_TEMPLATES },
    { id: "gpt-5.4-mini", templates: GPT_54_MINI_TEMPLATES },
    { id: "gpt-5.4-nano", templates: GPT_54_NANO_TEMPLATES },
  ];

  for (const { id, templates } of forwardCompatModels) {
    const template = findInlineCatalogTemplate(entries, OPENAI_PROVIDER, templates);
    if (template && !existingIds.has(`${normalizeProviderId(OPENAI_PROVIDER)}::${id.toLowerCase()}`)) {
      result.push({
        ...template,
        id,
        name: id,
      });
    }
  }

  return result;
}

// Stub class — used by agent-engine.ts OOP facade
export class ModelCatalog {
  async load(): Promise<ModelCatalogEntry[]> { return await loadModelCatalog() ?? []; }
}
