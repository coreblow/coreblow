import type { StreamFn } from "@mariozechner/pi-agent-core";
import { streamSimple } from "@mariozechner/pi-ai";
import { createSubsystemLogger } from "coreblow/plugin-sdk/logging-core";
import type { ProviderWrapStreamFnContext } from "coreblow/plugin-sdk/plugin-entry";
import { LMSTUDIO_PROVIDER_ID } from "./defaults.js";
import { ensureLmstudioModelLoaded } from "./models.fetch.js";
import { resolveLmstudioInferenceBase } from "./models.js";
import { resolveLmstudioProviderHeaders, resolveLmstudioRuntimeApiKey } from "./runtime.js";

const log = createSubsystemLogger("extensions/lmstudio/stream");

type StreamModel = Parameters<StreamFn>[0];

const preloadInFlight = new Map<string, Promise<void>>();
const preloadCooldown = new Map<string, { untilMs: number; consecutiveFailures: number }>();
const PRELOAD_BACKOFF_BASE_MS = 5_000;
const PRELOAD_BACKOFF_MAX_MS = 300_000;

export function resetLmstudioPreloadCooldownForTest(): void {
  preloadCooldown.clear();
  preloadInFlight.clear();
}

function normalizeLmstudioModelKey(modelId: string): string {
  const trimmed = modelId.trim();
  return trimmed.toLowerCase().startsWith("lmstudio/") ? trimmed.slice("lmstudio/".length) : trimmed;
}

function resolveRequestedContextLength(model: StreamModel): number | undefined {
  const contextWindow =
    typeof model.contextWindow === "number" && Number.isFinite(model.contextWindow)
      ? Math.floor(model.contextWindow)
      : undefined;
  return contextWindow && contextWindow > 0 ? contextWindow : undefined;
}

function shouldPreloadLmstudioModels(value: unknown): boolean {
  const providerConfig =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  const params =
    providerConfig?.params && typeof providerConfig.params === "object"
      ? (providerConfig.params as Record<string, unknown>)
      : undefined;
  return params?.preload !== false;
}

function isPreloadCoolingDown(preloadKey: string, now: number) {
  const entry = preloadCooldown.get(preloadKey);
  if (!entry) {
    return undefined;
  }
  if (entry.untilMs <= now) {
    preloadCooldown.delete(preloadKey);
    return undefined;
  }
  return entry;
}

function recordPreloadFailure(preloadKey: string, now: number) {
  const consecutiveFailures = (preloadCooldown.get(preloadKey)?.consecutiveFailures ?? 0) + 1;
  const raw = PRELOAD_BACKOFF_BASE_MS * 2 ** Math.max(0, consecutiveFailures - 1);
  const entry = {
    consecutiveFailures,
    untilMs: now + Math.min(PRELOAD_BACKOFF_MAX_MS, raw),
  };
  preloadCooldown.set(preloadKey, entry);
  return entry;
}

function withLmstudioUsageCompat(model: StreamModel): StreamModel {
  return {
    ...model,
    compat: {
      ...(model.compat && typeof model.compat === "object" ? model.compat : {}),
      supportsUsageInStreaming: true,
    },
  };
}

export function wrapLmstudioInferencePreload(ctx: ProviderWrapStreamFnContext): StreamFn | undefined {
  if (ctx.provider !== LMSTUDIO_PROVIDER_ID && ctx.model?.provider !== LMSTUDIO_PROVIDER_ID) {
    return undefined;
  }
  const underlying = ctx.streamFn ?? streamSimple;
  return (model, context, options) => {
    const nextModel = withLmstudioUsageCompat(model);
    const providerConfig = ctx.config?.models?.providers?.lmstudio;
    if (!shouldPreloadLmstudioModels(providerConfig)) {
      return underlying(nextModel, context, options);
    }
    const baseUrl = resolveLmstudioInferenceBase(providerConfig?.baseUrl ?? nextModel.baseUrl);
    const modelKey = normalizeLmstudioModelKey(nextModel.id);
    const preloadKey = `${baseUrl}::${modelKey}::${resolveRequestedContextLength(nextModel) ?? ""}`;
    const now = Date.now();
    if (!isPreloadCoolingDown(preloadKey, now)) {
      const preload =
        preloadInFlight.get(preloadKey) ??
        (async () => {
          try {
            const headers = await resolveLmstudioProviderHeaders({
              config: ctx.config,
              headers: providerConfig?.headers,
            });
            const apiKey = await resolveLmstudioRuntimeApiKey({
              config: ctx.config,
              headers,
            });
            await ensureLmstudioModelLoaded({
              baseUrl,
              apiKey,
              headers,
              modelKey,
              requestedContextLength: resolveRequestedContextLength(nextModel),
            });
            preloadCooldown.delete(preloadKey);
          } catch (error) {
            const entry = recordPreloadFailure(preloadKey, Date.now());
            log.warn(
              `LM Studio inference preload failed; retrying after ${Math.round((entry.untilMs - Date.now()) / 1000)}s: ${error instanceof Error ? error.message : String(error)}`,
            );
          } finally {
            preloadInFlight.delete(preloadKey);
          }
        })();
      preloadInFlight.set(preloadKey, preload);
    }
    return underlying(nextModel, context, options);
  };
}
