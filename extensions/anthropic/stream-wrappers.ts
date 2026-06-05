import type { StreamFn } from "@mariozechner/pi-agent-core";
import { streamSimple } from "@mariozechner/pi-ai";
import type { ProviderWrapStreamFnContext } from "coreblow/plugin-sdk/plugin-entry";
import { streamWithPayloadPatch } from "coreblow/plugin-sdk/provider-stream";

const ANTHROPIC_CONTEXT_1M_BETA = "context-1m-2025-08-07";
const ANTHROPIC_1M_MODEL_PREFIXES = ["claude-opus-4", "claude-sonnet-4"] as const;
const PI_AI_DEFAULT_ANTHROPIC_BETAS = [
  "fine-grained-tool-streaming-2025-05-14",
  "interleaved-thinking-2025-05-14",
] as const;
const PI_AI_OAUTH_ANTHROPIC_BETAS = [
  "claude-code-20250219",
  "oauth-2025-04-20",
  ...PI_AI_DEFAULT_ANTHROPIC_BETAS,
] as const;

type AnthropicServiceTier = "auto" | "standard_only";

const log = {
  warn(message: string) {
    console.warn(`[anthropic-stream] ${message}`);
  },
};

function normalizeLowercaseStringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function readStringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isAnthropic1MModel(modelId: string): boolean {
  const normalized = normalizeLowercaseStringOrEmpty(modelId);
  return ANTHROPIC_1M_MODEL_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function parseHeaderList(value: unknown): string[] {
  if (typeof value !== "string") {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function mergeAnthropicBetaHeader(
  headers: Record<string, string> | undefined,
  betas: readonly string[],
): Record<string, string> {
  const merged = { ...(headers ?? {}) };
  const existingKey = Object.keys(merged).find(
    (key) => normalizeLowercaseStringOrEmpty(key) === "anthropic-beta",
  );
  const existing = existingKey ? parseHeaderList(merged[existingKey]) : [];
  const key = existingKey ?? "anthropic-beta";
  merged[key] = [...new Set([...existing, ...betas])].join(",");
  return merged;
}

function isAnthropicOAuthApiKey(apiKey: unknown): boolean {
  return typeof apiKey === "string" && apiKey.includes("sk-ant-oat");
}

function normalizeAnthropicServiceTier(value: unknown): AnthropicServiceTier | undefined {
  const normalized = normalizeLowercaseStringOrEmpty(value);
  return normalized === "auto" || normalized === "standard_only" ? normalized : undefined;
}

function normalizeFastMode(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = normalizeLowercaseStringOrEmpty(value);
  if (["1", "true", "yes", "on", "auto"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off", "standard_only"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function providerAllowsAnthropicServiceTier(model: {
  provider?: unknown;
  api?: unknown;
  baseUrl?: unknown;
}): boolean {
  const provider = normalizeLowercaseStringOrEmpty(model.provider);
  const api = normalizeLowercaseStringOrEmpty(model.api);
  const baseUrl = normalizeLowercaseStringOrEmpty(model.baseUrl);
  return (
    provider === "anthropic" ||
    provider === "claude-cli" ||
    api === "anthropic-messages" ||
    baseUrl.includes("api.anthropic.com")
  );
}

function stripTrailingThinkingPrefill(payload: Record<string, unknown>): number {
  const thinking = payload.thinking;
  if (!thinking || typeof thinking !== "object") {
    return 0;
  }
  const thinkingType = (thinking as Record<string, unknown>).type;
  if (thinkingType === "disabled") {
    return 0;
  }
  const messages = payload.messages;
  if (!Array.isArray(messages)) {
    return 0;
  }
  let stripped = 0;
  while (messages.length > 0) {
    const last = messages[messages.length - 1];
    if (!last || typeof last !== "object" || Array.isArray(last)) {
      break;
    }
    const record = last as Record<string, unknown>;
    if (record.role !== "assistant") {
      break;
    }
    if (Array.isArray(record.content)) {
      const hasToolUse = record.content.some(
        (part) =>
          part &&
          typeof part === "object" &&
          !Array.isArray(part) &&
          (part as Record<string, unknown>).type === "tool_use",
      );
      if (hasToolUse) {
        break;
      }
    }
    messages.pop();
    stripped += 1;
  }
  return stripped;
}

function composeProviderStreamWrappers(
  streamFn: StreamFn | undefined,
  ...wrappers: Array<((streamFn: StreamFn | undefined) => StreamFn | undefined) | undefined>
): StreamFn | undefined {
  return wrappers.reduce<StreamFn | undefined>(
    (current, wrapper) => (wrapper ? wrapper(current) : current),
    streamFn,
  );
}

export function resolveAnthropicBetas(
  extraParams: Record<string, unknown> | undefined,
  modelId: string,
): string[] | undefined {
  const betas = new Set<string>();
  const configured = extraParams?.anthropicBeta;
  if (typeof configured === "string" && configured.trim()) {
    betas.add(configured.trim());
  } else if (Array.isArray(configured)) {
    for (const beta of configured) {
      if (typeof beta === "string" && beta.trim()) {
        betas.add(beta.trim());
      }
    }
  }
  if (extraParams?.context1m === true) {
    if (isAnthropic1MModel(modelId)) {
      betas.add(ANTHROPIC_CONTEXT_1M_BETA);
    } else {
      log.warn(`ignoring context1m for non-opus/sonnet model: anthropic/${modelId}`);
    }
  }
  return betas.size > 0 ? [...betas] : undefined;
}

export function createAnthropicBetaHeadersWrapper(
  baseStreamFn: StreamFn | undefined,
  betas: readonly string[],
): StreamFn {
  const underlying = baseStreamFn ?? streamSimple;
  return (model, context, options) => {
    const requestedContext1m = betas.includes(ANTHROPIC_CONTEXT_1M_BETA);
    const isOauth = isAnthropicOAuthApiKey(options?.apiKey);
    const effectiveBetas =
      isOauth && requestedContext1m
        ? betas.filter((beta) => beta !== ANTHROPIC_CONTEXT_1M_BETA)
        : betas;
    if (isOauth && requestedContext1m) {
      log.warn(
        `ignoring context1m for Anthropic token auth on ${model.provider}/${model.id}; Anthropic rejects context-1m beta with non-API-key auth`,
      );
    }
    const baseBetas = isOauth ? PI_AI_OAUTH_ANTHROPIC_BETAS : PI_AI_DEFAULT_ANTHROPIC_BETAS;
    return underlying(model, context, {
      ...options,
      headers: mergeAnthropicBetaHeader(options?.headers, [...baseBetas, ...effectiveBetas]),
    });
  };
}

export function createAnthropicServiceTierWrapper(
  baseStreamFn: StreamFn | undefined,
  serviceTier: AnthropicServiceTier,
): StreamFn {
  const underlying = baseStreamFn ?? streamSimple;
  return (model, context, options) => {
    if (isAnthropicOAuthApiKey(options?.apiKey) || !providerAllowsAnthropicServiceTier(model)) {
      return underlying(model, context, options);
    }
    return streamWithPayloadPatch(underlying, model, context, options, (payloadObj) => {
      payloadObj.service_tier = serviceTier;
    });
  };
}

export function createAnthropicFastModeWrapper(
  baseStreamFn: StreamFn | undefined,
  enabled: boolean,
): StreamFn {
  return createAnthropicServiceTierWrapper(baseStreamFn, enabled ? "auto" : "standard_only");
}

export function createAnthropicThinkingPrefillWrapper(
  baseStreamFn: StreamFn | undefined,
): StreamFn {
  const underlying = baseStreamFn ?? streamSimple;
  return (model, context, options) =>
    streamWithPayloadPatch(underlying, model, context, options, (payloadObj) => {
      const stripped = stripTrailingThinkingPrefill(payloadObj);
      if (stripped > 0) {
        log.warn(`removed ${stripped} trailing assistant prefill message for Anthropic thinking`);
      }
    });
}

export function resolveAnthropicFastMode(
  extraParams: Record<string, unknown> | undefined,
): boolean | undefined {
  return normalizeFastMode(extraParams?.fastMode ?? extraParams?.fast_mode);
}

export function resolveAnthropicServiceTier(
  extraParams: Record<string, unknown> | undefined,
): AnthropicServiceTier | undefined {
  const raw = extraParams?.serviceTier ?? extraParams?.service_tier;
  const normalized = normalizeAnthropicServiceTier(raw);
  if (raw !== undefined && normalized === undefined) {
    log.warn(`ignoring invalid Anthropic service tier param: ${readStringValue(raw) ?? typeof raw}`);
  }
  return normalized;
}

export function wrapAnthropicProviderStream(
  ctx: ProviderWrapStreamFnContext,
): StreamFn | undefined {
  const anthropicBetas = resolveAnthropicBetas(ctx.extraParams, ctx.modelId);
  const serviceTier = resolveAnthropicServiceTier(ctx.extraParams);
  const fastMode = resolveAnthropicFastMode(ctx.extraParams);
  return composeProviderStreamWrappers(
    ctx.streamFn,
    anthropicBetas?.length
      ? (streamFn) => createAnthropicBetaHeadersWrapper(streamFn, anthropicBetas)
      : undefined,
    serviceTier
      ? (streamFn) => createAnthropicServiceTierWrapper(streamFn, serviceTier)
      : undefined,
    fastMode !== undefined
      ? (streamFn) => createAnthropicFastModeWrapper(streamFn, fastMode)
      : undefined,
    (streamFn) => createAnthropicThinkingPrefillWrapper(streamFn),
  );
}

export const testing = {
  log,
};
