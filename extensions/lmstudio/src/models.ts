import type {
  ModelDefinitionConfig,
  ModelProviderConfig,
} from "coreblow/plugin-sdk/provider-model-shared";
import {
  SELF_HOSTED_DEFAULT_CONTEXT_WINDOW,
  SELF_HOSTED_DEFAULT_COST,
  SELF_HOSTED_DEFAULT_MAX_TOKENS,
} from "coreblow/plugin-sdk/provider-setup";
import { LMSTUDIO_DEFAULT_BASE_URL, LMSTUDIO_DEFAULT_LOAD_CONTEXT_LENGTH } from "./defaults.js";

export type LmstudioModelWire = {
  type?: "llm" | "embedding";
  key?: string;
  display_name?: string;
  max_context_length?: number;
  format?: "gguf" | "mlx" | null;
  capabilities?: {
    vision?: boolean;
    trained_for_tool_use?: boolean;
    reasoning?: {
      allowed_options?: unknown;
      default?: unknown;
    };
  };
  loaded_instances?: Array<{
    id?: string;
    config?: {
      context_length?: number;
    } | null;
  } | null>;
};

type LmstudioConfiguredCatalogEntry = {
  id: string;
  name?: string;
  contextWindow?: number;
  contextTokens?: number;
  reasoning?: boolean;
  input?: ("text" | "image")[];
  compat?: ModelDefinitionConfig["compat"];
};

type ModelProviderConfigWithRequest = ModelProviderConfig & {
  request?: {
    allowPrivateNetwork?: boolean;
    [key: string]: unknown;
  };
};

const LMSTUDIO_OPENAI_COMPAT_ENABLED_REASONING_EFFORTS = [
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
] as const;

const LMSTUDIO_OPENAI_COMPAT_REASONING_EFFORTS = [
  "none",
  ...LMSTUDIO_OPENAI_COMPAT_ENABLED_REASONING_EFFORTS,
] as const;

function normalizeReasoningOption(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function isReasoningEnabledOption(value: unknown): boolean {
  const normalized = normalizeReasoningOption(value);
  return Boolean(normalized && normalized !== "off");
}

function normalizeReasoningOptions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [
    ...new Set(
      value
        .map((option) => normalizeReasoningOption(option))
        .filter((option): option is string => option !== null),
    ),
  ];
}

function isLmstudioBinaryReasoningOptions(allowedOptions: readonly string[]): boolean {
  return (
    allowedOptions.some((option) => option === "on") &&
    allowedOptions.every((option) => option === "on" || option === "off")
  );
}

function resolveLmstudioTransportReasoningEfforts(allowedOptions: readonly string[]): string[] {
  if (isLmstudioBinaryReasoningOptions(allowedOptions)) {
    return allowedOptions.includes("off")
      ? [...LMSTUDIO_OPENAI_COMPAT_REASONING_EFFORTS]
      : [...LMSTUDIO_OPENAI_COMPAT_ENABLED_REASONING_EFFORTS];
  }
  return [
    ...new Set(
      allowedOptions
        .map((option) => (option === "off" ? "none" : option))
        .filter((option) => option !== "on"),
    ),
  ];
}

function resolveLmstudioEnabledTransportReasoningOption(
  supportedReasoningEfforts: readonly string[],
): string | undefined {
  return (
    supportedReasoningEfforts.find((option) => option === "xhigh") ??
    supportedReasoningEfforts.find((option) => option === "high") ??
    supportedReasoningEfforts.find((option) => option !== "none")
  );
}

function buildLmstudioReasoningEffortMap(
  supportedReasoningEfforts: readonly string[],
): Record<string, string> | undefined {
  const disabled = supportedReasoningEfforts.includes("none") ? "none" : undefined;
  const max = resolveLmstudioEnabledTransportReasoningOption(supportedReasoningEfforts);
  const map = {
    ...(disabled ? { off: disabled, none: disabled } : {}),
    ...(max ? { adaptive: max, max } : {}),
  };
  return Object.keys(map).length > 0 ? map : undefined;
}

function buildLmstudioReasoningCompat(
  allowedOptions: readonly string[],
): ModelDefinitionConfig["compat"] | undefined {
  const supportedReasoningEfforts = resolveLmstudioTransportReasoningEfforts(allowedOptions);
  if (
    supportedReasoningEfforts.length === 0 ||
    !supportedReasoningEfforts.some((option) => option !== "none")
  ) {
    return undefined;
  }
  return {
    supportsReasoningEffort: true,
    supportedReasoningEfforts,
    reasoningEffortMap: buildLmstudioReasoningEffortMap(supportedReasoningEfforts),
  };
}

function normalizeLmstudioTransportReasoningCompat(
  compat: NonNullable<ModelDefinitionConfig["compat"]>,
): NonNullable<ModelDefinitionConfig["compat"]> {
  const supportedReasoningEfforts = compat.supportedReasoningEfforts;
  const map = compat.reasoningEffortMap;
  const hasBinarySupported =
    Array.isArray(supportedReasoningEfforts) &&
    supportedReasoningEfforts.some((option) => option === "on");
  const hasBinaryMapValue =
    map !== undefined && Object.values(map).some((value) => value === "on" || value === "off");
  if (!hasBinarySupported && !hasBinaryMapValue) {
    return compat;
  }
  const hasDisabled =
    supportedReasoningEfforts?.includes("off") === true ||
    supportedReasoningEfforts?.includes("none") === true ||
    Object.values(map ?? {}).some((value) => value === "off" || value === "none");
  const normalizedSupportedReasoningEfforts = hasDisabled
    ? [...LMSTUDIO_OPENAI_COMPAT_REASONING_EFFORTS]
    : [...LMSTUDIO_OPENAI_COMPAT_ENABLED_REASONING_EFFORTS];
  return {
    ...compat,
    supportedReasoningEfforts: normalizedSupportedReasoningEfforts,
    reasoningEffortMap: buildLmstudioReasoningEffortMap(normalizedSupportedReasoningEfforts),
  };
}

export function resolveLmstudioReasoningCompat(
  entry: Pick<LmstudioModelWire, "capabilities">,
): ModelDefinitionConfig["compat"] | undefined {
  const reasoning = entry.capabilities?.reasoning;
  if (reasoning === undefined || reasoning === null) {
    return undefined;
  }
  const allowedOptions = normalizeReasoningOptions(reasoning.allowed_options);
  return allowedOptions.length > 0 ? buildLmstudioReasoningCompat(allowedOptions) : undefined;
}

export function resolveLmstudioReasoningCapability(
  entry: Pick<LmstudioModelWire, "capabilities">,
): boolean {
  const reasoning = entry.capabilities?.reasoning;
  if (reasoning === undefined || reasoning === null) {
    return false;
  }
  const allowedOptions = normalizeReasoningOptions(reasoning.allowed_options);
  if (allowedOptions.length > 0) {
    return allowedOptions.some((option) => isReasoningEnabledOption(option));
  }
  return isReasoningEnabledOption(reasoning.default);
}

export function resolveLoadedContextWindow(
  entry: Pick<LmstudioModelWire, "loaded_instances">,
): number | null {
  const loadedInstances = Array.isArray(entry.loaded_instances) ? entry.loaded_instances : [];
  let contextWindow: number | null = null;
  for (const instance of loadedInstances) {
    const length = instance?.config?.context_length;
    if (length === undefined || !Number.isFinite(length) || length <= 0) {
      continue;
    }
    const normalized = Math.floor(length);
    contextWindow = contextWindow === null ? normalized : Math.max(contextWindow, normalized);
  }
  return contextWindow;
}

function normalizeUrlPath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/u, "");
  if (!trimmed) {
    return "";
  }
  return trimmed.replace(/\/api\/v1$/iu, "").replace(/\/v1$/iu, "");
}

function hasExplicitHttpScheme(value: string): boolean {
  return /^https?:\/\//iu.test(value);
}

function isLikelyHostBaseUrl(value: string): boolean {
  return (
    /^(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|[a-z0-9.-]+\.[a-z]{2,}|[^/\s?#]+:\d+)(?:[/?#].*)?$/iu.test(
      value,
    ) && !value.startsWith("/")
  );
}

function toFetchableLmstudioBaseUrl(value: string): string {
  if (hasExplicitHttpScheme(value) || !isLikelyHostBaseUrl(value)) {
    return value;
  }
  return `http://${value}`;
}

export function resolveLmstudioServerBase(configuredBaseUrl?: string): string {
  const configured = configuredBaseUrl?.trim();
  const resolved = configured && configured.length > 0 ? configured : LMSTUDIO_DEFAULT_BASE_URL;
  const fetchableBaseUrl = toFetchableLmstudioBaseUrl(resolved);
  try {
    const parsed = new URL(fetchableBaseUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new TypeError(`Unsupported LM Studio protocol: ${parsed.protocol}`);
    }
    const pathname = normalizeUrlPath(parsed.pathname);
    parsed.pathname = pathname.length > 0 ? pathname : "/";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/u, "");
  } catch {
    const trimmed = resolved.replace(/\/+$/u, "");
    const normalized = normalizeUrlPath(trimmed);
    return normalized.length > 0 ? normalized : LMSTUDIO_DEFAULT_BASE_URL;
  }
}

export function resolveLmstudioInferenceBase(configuredBaseUrl?: string): string {
  return `${resolveLmstudioServerBase(configuredBaseUrl)}/v1`;
}

export function normalizeLmstudioProviderConfig(
  provider: ModelProviderConfig,
): ModelProviderConfig {
  const configuredBaseUrl = typeof provider.baseUrl === "string" ? provider.baseUrl.trim() : "";
  if (!configuredBaseUrl) {
    return provider;
  }
  const normalizedBaseUrl = resolveLmstudioInferenceBase(configuredBaseUrl);
  const providerWithRequest = provider as ModelProviderConfigWithRequest;
  const request =
    providerWithRequest.request &&
    typeof providerWithRequest.request === "object" &&
    !Array.isArray(providerWithRequest.request)
      ? providerWithRequest.request
      : undefined;
  const requestWithPrivateNetworkDefault =
    typeof request?.allowPrivateNetwork === "boolean"
      ? request
      : {
          ...request,
          allowPrivateNetwork: true,
        };
  return {
    ...provider,
    baseUrl: normalizedBaseUrl,
    request: requestWithPrivateNetworkDefault,
  } as ModelProviderConfigWithRequest;
}

function normalizeConfiguredReasoningEffortMap(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const normalized = Object.fromEntries(
    Object.entries(value)
      .map(([key, mapped]) => [key.trim(), typeof mapped === "string" ? mapped.trim() : ""])
      .filter(([key, mapped]) => key.length > 0 && mapped.length > 0),
  );
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeLmstudioConfiguredCompat(value: unknown): ModelDefinitionConfig["compat"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const supportedReasoningEfforts = normalizeReasoningOptions(record.supportedReasoningEfforts);
  const reasoningEffortMap = normalizeConfiguredReasoningEffortMap(record.reasoningEffortMap);
  const compat: NonNullable<ModelDefinitionConfig["compat"]> = {};
  if (typeof record.supportsUsageInStreaming === "boolean") {
    compat.supportsUsageInStreaming = record.supportsUsageInStreaming;
  }
  if (typeof record.supportsReasoningEffort === "boolean") {
    compat.supportsReasoningEffort = record.supportsReasoningEffort;
  }
  if (supportedReasoningEfforts.length > 0) {
    compat.supportedReasoningEfforts = supportedReasoningEfforts;
  }
  if (reasoningEffortMap) {
    compat.reasoningEffortMap = reasoningEffortMap;
  }
  return Object.keys(compat).length > 0
    ? normalizeLmstudioTransportReasoningCompat(compat)
    : undefined;
}

export function normalizeLmstudioConfiguredCatalogEntry(
  entry: unknown,
): LmstudioConfiguredCatalogEntry | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const record = entry as Record<string, unknown>;
  if (typeof record.id !== "string" || record.id.trim().length === 0) {
    return null;
  }
  const id = record.id.trim();
  const name = typeof record.name === "string" && record.name.trim().length > 0 ? record.name : id;
  const contextWindow =
    typeof record.contextWindow === "number" && record.contextWindow > 0
      ? record.contextWindow
      : undefined;
  const contextTokens =
    typeof record.contextTokens === "number" && record.contextTokens > 0
      ? record.contextTokens
      : undefined;
  const reasoning = typeof record.reasoning === "boolean" ? record.reasoning : undefined;
  const input = Array.isArray(record.input)
    ? record.input.filter((item): item is "text" | "image" => item === "text" || item === "image")
    : undefined;
  return {
    id,
    name,
    contextWindow,
    contextTokens,
    reasoning,
    input: input && input.length > 0 ? input : undefined,
    compat: normalizeLmstudioConfiguredCompat(record.compat),
  };
}

export function normalizeLmstudioConfiguredCatalogEntries(
  models: unknown,
): LmstudioConfiguredCatalogEntry[] {
  if (!Array.isArray(models)) {
    return [];
  }
  return models
    .map((entry) => normalizeLmstudioConfiguredCatalogEntry(entry))
    .filter((entry): entry is LmstudioConfiguredCatalogEntry => entry !== null);
}

export function buildLmstudioModelName(model: {
  displayName: string;
  format: "gguf" | "mlx" | null;
  vision: boolean;
  trainedForToolUse: boolean;
  loaded: boolean;
}): string {
  const tags: string[] = [];
  if (model.format === "mlx") {
    tags.push("MLX");
  } else if (model.format === "gguf") {
    tags.push("GGUF");
  }
  if (model.vision) {
    tags.push("vision");
  }
  if (model.trainedForToolUse) {
    tags.push("tool-use");
  }
  if (model.loaded) {
    tags.push("loaded");
  }
  return tags.length === 0 ? model.displayName : `${model.displayName} (${tags.join(", ")})`;
}

export type LmstudioModelBase = {
  id: string;
  displayName: string;
  format: "gguf" | "mlx" | null;
  vision: boolean;
  trainedForToolUse: boolean;
  loaded: boolean;
  reasoning: boolean;
  input: Array<"text" | "image">;
  cost: ModelDefinitionConfig["cost"];
  compat?: ModelDefinitionConfig["compat"];
  contextWindow: number;
  contextTokens: number;
  maxTokens: number;
};

export function mapLmstudioWireEntry(entry: LmstudioModelWire): LmstudioModelBase | null {
  if (entry.type !== "llm") {
    return null;
  }
  const id = entry.key?.trim() ?? "";
  if (!id) {
    return null;
  }
  const loadedContextWindow = resolveLoadedContextWindow(entry);
  const advertisedContextWindow =
    entry.max_context_length !== undefined &&
    Number.isFinite(entry.max_context_length) &&
    entry.max_context_length > 0
      ? Math.floor(entry.max_context_length)
      : null;
  const contextWindow = advertisedContextWindow ?? SELF_HOSTED_DEFAULT_CONTEXT_WINDOW;
  const contextTokens = Math.min(contextWindow, LMSTUDIO_DEFAULT_LOAD_CONTEXT_LENGTH);
  const rawDisplayName = entry.display_name?.trim();
  return {
    id,
    displayName: rawDisplayName && rawDisplayName.length > 0 ? rawDisplayName : id,
    format: entry.format ?? null,
    vision: entry.capabilities?.vision === true,
    trainedForToolUse: entry.capabilities?.trained_for_tool_use === true,
    loaded: loadedContextWindow !== null,
    reasoning: resolveLmstudioReasoningCapability(entry),
    input: entry.capabilities?.vision ? ["text", "image"] : ["text"],
    cost: SELF_HOSTED_DEFAULT_COST,
    compat: resolveLmstudioReasoningCompat(entry),
    contextWindow,
    contextTokens,
    maxTokens: Math.max(1, Math.min(contextWindow, SELF_HOSTED_DEFAULT_MAX_TOKENS)),
  };
}

export function mapLmstudioWireModelsToConfig(
  models: LmstudioModelWire[],
): ModelDefinitionConfig[] {
  return models
    .map((entry): ModelDefinitionConfig | null => {
      const base = mapLmstudioWireEntry(entry);
      if (!base) {
        return null;
      }
      return {
        id: base.id,
        name: base.displayName,
        reasoning: base.reasoning,
        input: base.input,
        cost: base.cost,
        ...(base.compat ? { compat: base.compat } : {}),
        contextWindow: base.contextWindow,
        maxTokens: base.maxTokens,
      };
    })
    .filter((entry): entry is ModelDefinitionConfig => entry !== null);
}
