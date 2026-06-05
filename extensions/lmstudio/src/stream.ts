import type { StreamFn } from "@mariozechner/pi-agent-core";
import { streamSimple } from "@mariozechner/pi-ai";
import { createSubsystemLogger } from "coreblow/plugin-sdk/logging-core";
import type { ProviderWrapStreamFnContext } from "coreblow/plugin-sdk/plugin-entry";
import { LMSTUDIO_PROVIDER_ID } from "./defaults.js";
import { ensureLmstudioModelLoaded } from "./models.fetch.js";
import { resolveLmstudioInferenceBase } from "./models.js";
import {
  createLmstudioSyntheticToolCallId,
  parseLmstudioPlainTextToolCalls,
} from "./plain-text-tool-calls.js";
import { resolveLmstudioProviderHeaders, resolveLmstudioRuntimeApiKey } from "./runtime.js";

const log = createSubsystemLogger("extensions/lmstudio/stream");

type StreamModel = Parameters<StreamFn>[0];
type StreamContext = Parameters<StreamFn>[1];
type StreamOptions = Parameters<StreamFn>[2];
type StreamResult = ReturnType<StreamFn>;

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
  const modelWithContextTokens = model as unknown as { contextTokens?: unknown };
  const contextTokens =
    typeof modelWithContextTokens.contextTokens === "number" &&
    Number.isFinite(modelWithContextTokens.contextTokens)
      ? Math.floor(modelWithContextTokens.contextTokens)
      : undefined;
  if (contextTokens && contextTokens > 0) {
    return contextTokens;
  }
  const contextWindow =
    typeof model.contextWindow === "number" && Number.isFinite(model.contextWindow)
      ? Math.floor(model.contextWindow)
      : undefined;
  return contextWindow && contextWindow > 0 ? contextWindow : undefined;
}

function buildRemoteBaseUrlPolicy(baseUrl: string): { allowedHostnames: string[] } | undefined {
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }
    return { allowedHostnames: [parsed.hostname] };
  } catch {
    return undefined;
  }
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

function collectAllowedToolNames(context: StreamContext): Set<string> {
  const tools = (context as { tools?: unknown }).tools;
  if (!Array.isArray(tools)) {
    return new Set();
  }
  return new Set(
    tools
      .map((tool) =>
        tool && typeof tool === "object" && typeof (tool as { name?: unknown }).name === "string"
          ? (tool as { name: string }).name.trim()
          : "",
      )
      .filter(Boolean),
  );
}

function replaceMessagePlainTextToolCalls(message: unknown, allowedToolNames: Set<string>): boolean {
  if (!message || typeof message !== "object") {
    return false;
  }
  const typed = message as {
    content?: unknown;
    stopReason?: unknown;
  };
  if (!Array.isArray(typed.content)) {
    return false;
  }
  let changed = false;
  const nextContent: unknown[] = [];
  for (const block of typed.content) {
    if (
      !block ||
      typeof block !== "object" ||
      (block as { type?: unknown }).type !== "text" ||
      typeof (block as { text?: unknown }).text !== "string"
    ) {
      nextContent.push(block);
      continue;
    }
    const parsed = parseLmstudioPlainTextToolCalls(
      (block as { text: string }).text,
      allowedToolNames,
    );
    if (!parsed) {
      nextContent.push(block);
      continue;
    }
    for (const toolCall of parsed) {
      nextContent.push({
        type: "toolCall",
        id: createLmstudioSyntheticToolCallId(),
        name: toolCall.name,
        arguments: toolCall.arguments,
      });
    }
    changed = true;
  }
  if (!changed) {
    return false;
  }
  typed.content = nextContent;
  if (typed.stopReason === "stop") {
    typed.stopReason = "toolUse";
  }
  return true;
}

function transformLmstudioStreamEvent(event: unknown, allowedToolNames: Set<string>): unknown {
  if (!event || typeof event !== "object") {
    return event;
  }
  const typed = event as { message?: unknown; partial?: unknown; reason?: unknown };
  const changedMessage = replaceMessagePlainTextToolCalls(typed.message, allowedToolNames);
  const changedPartial = replaceMessagePlainTextToolCalls(typed.partial, allowedToolNames);
  if ((changedMessage || changedPartial) && typed.reason === "stop") {
    typed.reason = "toolUse";
  }
  return event;
}

function wrapLmstudioPlainTextToolCallStream(stream: StreamResult, context: StreamContext): StreamResult {
  const allowedToolNames = collectAllowedToolNames(context);
  if (allowedToolNames.size === 0 || !stream || typeof stream !== "object") {
    return stream;
  }
  const maybeResult = stream as {
    result?: () => Promise<unknown>;
    [Symbol.asyncIterator]?: () => AsyncIterator<unknown>;
  };
  if (typeof maybeResult.result === "function") {
    const originalResult = maybeResult.result.bind(stream);
    maybeResult.result = async () => {
      const message = await originalResult();
      replaceMessagePlainTextToolCalls(message, allowedToolNames);
      return message;
    };
  }
  const originalAsyncIterator = maybeResult[Symbol.asyncIterator];
  if (typeof originalAsyncIterator === "function") {
    const boundAsyncIterator = originalAsyncIterator.bind(stream);
    maybeResult[Symbol.asyncIterator] = function () {
      const iterator = boundAsyncIterator();
      return {
        async next() {
          const result = await iterator.next();
          if (!result.done) {
            transformLmstudioStreamEvent(result.value, allowedToolNames);
          }
          return result;
        },
        async return(value?: unknown) {
          return iterator.return?.(value) ?? { done: true as const, value: undefined };
        },
        async throw(error?: unknown) {
          return iterator.throw?.(error) ?? { done: true as const, value: undefined };
        },
      };
    };
  }
  return stream;
}

async function preloadLmstudioModel(params: {
  baseUrl: string;
  config: ProviderWrapStreamFnContext["config"];
  headers: unknown;
  modelKey: string;
  requestedContextLength?: number;
  options: StreamOptions;
}): Promise<void> {
  const headers = await resolveLmstudioProviderHeaders({
    config: params.config,
    headers: params.headers,
  });
  const optionApiKey =
    params.options &&
    typeof (params.options as { apiKey?: unknown }).apiKey === "string" &&
    (params.options as { apiKey: string }).apiKey.trim()
      ? (params.options as { apiKey: string }).apiKey.trim()
      : undefined;
  const apiKey =
    optionApiKey ??
    (await resolveLmstudioRuntimeApiKey({
      config: params.config,
      headers,
    }));
  await ensureLmstudioModelLoaded({
    baseUrl: params.baseUrl,
    apiKey,
    headers,
    ssrfPolicy: buildRemoteBaseUrlPolicy(params.baseUrl),
    modelKey: params.modelKey,
    requestedContextLength: params.requestedContextLength,
  });
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
      return wrapLmstudioPlainTextToolCallStream(underlying(nextModel, context, options), context);
    }
    const baseUrl = resolveLmstudioInferenceBase(providerConfig?.baseUrl ?? nextModel.baseUrl);
    const modelKey = normalizeLmstudioModelKey(nextModel.id);
    const requestedContextLength = resolveRequestedContextLength(nextModel);
    const preloadKey = `${baseUrl}::${modelKey}::${requestedContextLength ?? ""}`;
    const now = Date.now();
    let preload: Promise<void> | undefined;
    if (!isPreloadCoolingDown(preloadKey, now)) {
      preload =
        preloadInFlight.get(preloadKey) ??
        (async () => {
          try {
            await preloadLmstudioModel({
              baseUrl,
              config: ctx.config,
              headers: providerConfig?.headers,
              modelKey,
              requestedContextLength,
              options,
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
    const runUnderlying = () =>
      wrapLmstudioPlainTextToolCallStream(underlying(nextModel, context, options), context);
    return preload ? preload.then(runUnderlying, runUnderlying) : runUnderlying();
  };
}
