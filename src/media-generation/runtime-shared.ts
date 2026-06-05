import type { FallbackAttempt } from "../agents/model-fallback.types.js";
import type { CoreBlowConfig } from "../config/config.js";
import type { AgentModelConfig } from "../config/types.agents-shared.js";
import { formatErrorMessage } from "../infra/errors.js";
import type {
  MediaGenerationNormalizationMetadataInput,
  MediaNormalizationEntry,
  MediaNormalizationValue,
} from "./normalization.types.js";

export type ParsedProviderModelRef = {
  provider: string;
  model: string;
};

export type {
  MediaGenerationNormalizationMetadataInput,
  MediaNormalizationEntry,
  MediaNormalizationValue,
} from "./normalization.types.js";

type CapabilityProviderCandidate = {
  id: string;
  aliases?: readonly string[];
  defaultModel?: string | null;
  models?: readonly string[];
  isConfigured?: (ctx: { cfg?: CoreBlowConfig; agentDir?: string }) => boolean;
};

type ParsedAspectRatio = {
  width: number;
  height: number;
  value: number;
};

type ParsedSize = {
  width: number;
  height: number;
  aspectRatio: number;
  area: number;
};

const DEFAULT_PROVIDER = "openai";
const IMAGE_RESOLUTION_ORDER = ["1K", "2K", "4K"] as const;

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function resolveAgentModelPrimaryValue(model: AgentModelConfig | undefined): string | undefined {
  if (typeof model === "string") {
    return normalizeOptionalString(model);
  }
  return normalizeOptionalString(model?.primary);
}

function resolveAgentModelFallbackValues(model: AgentModelConfig | undefined): string[] {
  if (!model || typeof model === "string") {
    return [];
  }
  return (model.fallbacks ?? []).flatMap((entry) => {
    const normalized = normalizeOptionalString(entry);
    return normalized ? [normalized] : [];
  });
}

export function recordCapabilityCandidateFailure(params: {
  attempts: FallbackAttempt[];
  provider: string;
  model: string;
  error: unknown;
}): void {
  params.attempts.push({
    provider: params.provider,
    model: params.model,
    error: formatErrorMessage(params.error),
  });
}

export function hasMediaNormalizationEntry<TValue extends MediaNormalizationValue>(
  entry: MediaNormalizationEntry<TValue> | undefined,
): entry is MediaNormalizationEntry<TValue> {
  return Boolean(
    entry &&
      (entry.requested !== undefined ||
        entry.applied !== undefined ||
        entry.derivedFrom !== undefined ||
        (entry.supportedValues?.length ?? 0) > 0),
  );
}

function resolveCurrentDefaultProviderId(cfg?: CoreBlowConfig): string {
  const configured = resolveAgentModelPrimaryValue(cfg?.agents?.defaults?.model);
  const slash = configured?.indexOf("/") ?? -1;
  if (!configured || slash <= 0) {
    return DEFAULT_PROVIDER;
  }
  return normalizeOptionalString(configured.slice(0, slash)) ?? DEFAULT_PROVIDER;
}

function isCapabilityProviderConfigured(params: {
  provider: CapabilityProviderCandidate;
  cfg?: CoreBlowConfig;
  agentDir?: string;
}): boolean {
  return params.provider.isConfigured?.({ cfg: params.cfg, agentDir: params.agentDir }) ?? false;
}

function resolveAutoCapabilityFallbackRefs(params: {
  cfg: CoreBlowConfig;
  agentDir?: string;
  listProviders: (cfg?: CoreBlowConfig) => CapabilityProviderCandidate[];
}): string[] {
  const providerDefaults = new Map<string, { ref: string; aliases: string[] }>();
  for (const provider of params.listProviders(params.cfg)) {
    const providerId = normalizeOptionalString(provider.id);
    const modelId = normalizeOptionalString(provider.defaultModel);
    if (
      !providerId ||
      !modelId ||
      providerDefaults.has(providerId) ||
      !isCapabilityProviderConfigured({ provider, cfg: params.cfg, agentDir: params.agentDir })
    ) {
      continue;
    }
    const aliases = (provider.aliases ?? []).flatMap((alias) => {
      const normalized = normalizeOptionalString(alias);
      return normalized ? [normalized] : [];
    });
    providerDefaults.set(providerId, { ref: `${providerId}/${modelId}`, aliases });
  }

  const defaultProvider = resolveCurrentDefaultProviderId(params.cfg);
  const providerIds = [...providerDefaults.keys()].sort();
  const matchesDefaultProvider = (providerId: string): boolean => {
    const entry = providerDefaults.get(providerId);
    return providerId === defaultProvider || (entry?.aliases ?? []).includes(defaultProvider);
  };
  return [
    ...providerIds.filter(matchesDefaultProvider),
    ...providerIds.filter((providerId) => !matchesDefaultProvider(providerId)),
  ].flatMap((providerId) => {
    const entry = providerDefaults.get(providerId);
    return entry ? [entry.ref] : [];
  });
}

function resolveProviderModelOnlyRef(params: {
  raw: string;
  providers: CapabilityProviderCandidate[];
}): ParsedProviderModelRef | null {
  const model = normalizeOptionalString(params.raw);
  if (!model) {
    return null;
  }
  const provider = params.providers.find((candidate) =>
    [candidate.defaultModel, ...(candidate.models ?? [])].some(
      (entry) => normalizeOptionalString(entry) === model,
    ),
  );
  return provider ? { provider: provider.id, model } : null;
}

function hasCapabilityProviderId(params: {
  providerId: string | undefined;
  providers: CapabilityProviderCandidate[];
}): boolean {
  const providerId = normalizeOptionalString(params.providerId);
  return Boolean(
    providerId &&
      params.providers.some(
        (provider) =>
          provider.id === providerId ||
          (provider.aliases ?? []).some((alias) => normalizeOptionalString(alias) === providerId),
      ),
  );
}

export function resolveCapabilityModelCandidates(params: {
  cfg: CoreBlowConfig;
  modelConfig: AgentModelConfig | undefined;
  modelOverride?: string;
  parseModelRef: (raw: string | undefined) => ParsedProviderModelRef | null;
  agentDir?: string;
  listProviders?: (cfg?: CoreBlowConfig) => CapabilityProviderCandidate[];
  autoProviderFallback?: boolean;
}): ParsedProviderModelRef[] {
  const candidates: ParsedProviderModelRef[] = [];
  const seen = new Set<string>();
  let providers: CapabilityProviderCandidate[] | undefined;
  const getProviders = (): CapabilityProviderCandidate[] => {
    providers ??= params.listProviders?.(params.cfg) ?? [];
    return providers;
  };
  const resolveCandidate = (raw: string | undefined, options: { useProviderMetadata: boolean }) => {
    const trimmed = normalizeOptionalString(raw);
    if (!trimmed) {
      return null;
    }
    const parsed = params.parseModelRef(raw);
    if (!options.useProviderMetadata) {
      return parsed;
    }
    if (parsed && hasCapabilityProviderId({ providerId: parsed.provider, providers: getProviders() })) {
      return parsed;
    }
    return resolveProviderModelOnlyRef({ raw: trimmed, providers: getProviders() }) ?? parsed;
  };
  const add = (raw: string | undefined, options: { useProviderMetadata: boolean }) => {
    const candidate = resolveCandidate(raw, options);
    if (!candidate) {
      return;
    }
    const key = `${candidate.provider}/${candidate.model}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    candidates.push(candidate);
  };

  const override = resolveCandidate(params.modelOverride, { useProviderMetadata: true });
  if (override) {
    return [override];
  }

  const autoProviderFallbackEnabled =
    params.autoProviderFallback ??
    (params.cfg.agents?.defaults as { mediaGenerationAutoProviderFallback?: boolean } | undefined)
      ?.mediaGenerationAutoProviderFallback !==
      false;
  add(resolveAgentModelPrimaryValue(params.modelConfig), {
    useProviderMetadata: autoProviderFallbackEnabled,
  });
  for (const fallback of resolveAgentModelFallbackValues(params.modelConfig)) {
    add(fallback, { useProviderMetadata: autoProviderFallbackEnabled });
  }
  if (autoProviderFallbackEnabled && params.listProviders) {
    for (const candidate of resolveAutoCapabilityFallbackRefs({
      cfg: params.cfg,
      agentDir: params.agentDir,
      listProviders: () => getProviders(),
    })) {
      add(candidate, { useProviderMetadata: false });
    }
  }
  return candidates;
}

function normalizeSupportedValues<TValue extends string>(values?: readonly TValue[]): TValue[] {
  return (values ?? []).flatMap((entry) => {
    const normalized = normalizeOptionalString(entry);
    return normalized ? [entry] : [];
  });
}

function compareScores(
  next: { primary: number; secondary: number; tertiary: string },
  best: { primary: number; secondary: number; tertiary: string } | null,
): boolean {
  if (!best) {
    return true;
  }
  if (next.primary !== best.primary) {
    return next.primary < best.primary;
  }
  if (next.secondary !== best.secondary) {
    return next.secondary < best.secondary;
  }
  return next.tertiary.localeCompare(best.tertiary) < 0;
}

function parsePositiveDimensionPair(
  raw: string | null | undefined,
  pattern: RegExp,
): { width: number; height: number } | null {
  const trimmed = normalizeOptionalString(raw);
  if (!trimmed) {
    return null;
  }
  const match = pattern.exec(trimmed);
  if (!match) {
    return null;
  }
  const width = Number(match[1]);
  const height = Number(match[2]);
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
    ? { width, height }
    : null;
}

function parseAspectRatioValue(raw?: string | null): ParsedAspectRatio | null {
  const pair = parsePositiveDimensionPair(raw, /^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
  return pair ? { ...pair, value: pair.width / pair.height } : null;
}

function parseSizeValue(raw?: string | null): ParsedSize | null {
  const pair = parsePositiveDimensionPair(raw, /^(\d+)\s*x\s*(\d+)$/i);
  return pair
    ? {
        ...pair,
        aspectRatio: pair.width / pair.height,
        area: pair.width * pair.height,
      }
    : null;
}

function greatestCommonDivisor(a: number, b: number): number {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right !== 0) {
    const next = left % right;
    left = right;
    right = next;
  }
  return left || 1;
}

export function deriveAspectRatioFromSize(size?: string): string | undefined {
  const parsed = parseSizeValue(size);
  if (!parsed) {
    return undefined;
  }
  const divisor = greatestCommonDivisor(parsed.width, parsed.height);
  return `${parsed.width / divisor}:${parsed.height / divisor}`;
}

export function resolveClosestAspectRatio(params: {
  requestedAspectRatio?: string;
  requestedSize?: string;
  supportedAspectRatios?: readonly string[];
}): string | undefined {
  const supported = normalizeSupportedValues(params.supportedAspectRatios);
  if (supported.length === 0) {
    return params.requestedAspectRatio ?? deriveAspectRatioFromSize(params.requestedSize);
  }
  if (params.requestedAspectRatio && supported.includes(params.requestedAspectRatio)) {
    return params.requestedAspectRatio;
  }
  const requested =
    parseAspectRatioValue(params.requestedAspectRatio) ??
    parseAspectRatioValue(deriveAspectRatioFromSize(params.requestedSize));
  if (!requested) {
    return undefined;
  }
  let bestValue: string | undefined;
  let bestScore: { primary: number; secondary: number; tertiary: string } | null = null;
  for (const candidate of supported) {
    const parsed = parseAspectRatioValue(candidate);
    if (!parsed) {
      continue;
    }
    const score = {
      primary: Math.abs(Math.log(parsed.value / requested.value)),
      secondary: Math.abs(parsed.width * requested.height - requested.width * parsed.height),
      tertiary: candidate,
    };
    if (compareScores(score, bestScore)) {
      bestValue = candidate;
      bestScore = score;
    }
  }
  return bestValue;
}

export function resolveClosestSize(params: {
  requestedSize?: string;
  requestedAspectRatio?: string;
  supportedSizes?: readonly string[];
}): string | undefined {
  const supported = normalizeSupportedValues(params.supportedSizes);
  if (supported.length === 0) {
    return params.requestedSize;
  }
  if (params.requestedSize && supported.includes(params.requestedSize)) {
    return params.requestedSize;
  }
  const requested = parseSizeValue(params.requestedSize);
  const requestedAspectRatio = parseAspectRatioValue(params.requestedAspectRatio);
  if (!requested && !requestedAspectRatio) {
    return undefined;
  }
  let bestValue: string | undefined;
  let bestScore: { primary: number; secondary: number; tertiary: string } | null = null;
  for (const candidate of supported) {
    const parsed = parseSizeValue(candidate);
    if (!parsed) {
      continue;
    }
    const score = {
      primary: Math.abs(
        Math.log(parsed.aspectRatio / (requested?.aspectRatio ?? requestedAspectRatio!.value)),
      ),
      secondary: requested ? Math.abs(Math.log(parsed.area / requested.area)) : parsed.area,
      tertiary: candidate,
    };
    if (compareScores(score, bestScore)) {
      bestValue = candidate;
      bestScore = score;
    }
  }
  return bestValue;
}

export function resolveClosestResolution<TResolution extends string>(params: {
  requestedResolution?: TResolution;
  supportedResolutions?: readonly TResolution[];
  order?: readonly TResolution[];
}): TResolution | undefined {
  const supported = normalizeSupportedValues(params.supportedResolutions);
  if (supported.length === 0) {
    return params.requestedResolution;
  }
  if (params.requestedResolution && supported.includes(params.requestedResolution)) {
    return params.requestedResolution;
  }
  const order: readonly string[] = params.order ?? IMAGE_RESOLUTION_ORDER;
  const requestedIndex = params.requestedResolution ? order.indexOf(params.requestedResolution) : -1;
  if (requestedIndex < 0) {
    return undefined;
  }
  let bestValue: TResolution | undefined;
  let bestScore: { primary: number; secondary: number; tertiary: string } | null = null;
  for (const candidate of supported) {
    const candidateIndex = order.indexOf(candidate);
    if (candidateIndex < 0) {
      continue;
    }
    const score = {
      primary: Math.abs(candidateIndex - requestedIndex),
      secondary: candidateIndex,
      tertiary: candidate,
    };
    if (compareScores(score, bestScore)) {
      bestValue = candidate;
      bestScore = score;
    }
  }
  return bestValue;
}

export function normalizeDurationToClosestMax(
  durationSeconds?: number,
  maxDurationSeconds?: number,
): number | undefined {
  if (typeof durationSeconds !== "number" || !Number.isFinite(durationSeconds)) {
    return undefined;
  }
  const rounded = Math.max(1, Math.round(durationSeconds));
  if (
    typeof maxDurationSeconds !== "number" ||
    !Number.isFinite(maxDurationSeconds) ||
    maxDurationSeconds <= 0
  ) {
    return rounded;
  }
  return Math.min(rounded, Math.max(1, Math.round(maxDurationSeconds)));
}

export function buildMediaGenerationNormalizationMetadata(params: {
  normalization?: MediaGenerationNormalizationMetadataInput;
  requestedSizeForDerivedAspectRatio?: string;
  includeSupportedDurationSeconds?: boolean;
}): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  const { normalization } = params;
  if (normalization?.size?.requested !== undefined && normalization.size.applied !== undefined) {
    metadata.requestedSize = normalization.size.requested;
    metadata.normalizedSize = normalization.size.applied;
  }
  if (normalization?.aspectRatio?.applied !== undefined) {
    if (normalization.aspectRatio.requested !== undefined) {
      metadata.requestedAspectRatio = normalization.aspectRatio.requested;
    }
    metadata.normalizedAspectRatio = normalization.aspectRatio.applied;
    if (
      normalization.aspectRatio.derivedFrom === "size" &&
      params.requestedSizeForDerivedAspectRatio
    ) {
      metadata.requestedSize = params.requestedSizeForDerivedAspectRatio;
      metadata.aspectRatioDerivedFromSize = deriveAspectRatioFromSize(
        params.requestedSizeForDerivedAspectRatio,
      );
    }
  }
  if (
    normalization?.resolution?.requested !== undefined &&
    normalization.resolution.applied !== undefined
  ) {
    metadata.requestedResolution = normalization.resolution.requested;
    metadata.normalizedResolution = normalization.resolution.applied;
  }
  if (
    normalization?.durationSeconds?.requested !== undefined &&
    normalization.durationSeconds.applied !== undefined
  ) {
    metadata.requestedDurationSeconds = normalization.durationSeconds.requested;
    metadata.normalizedDurationSeconds = normalization.durationSeconds.applied;
  }
  if (params.includeSupportedDurationSeconds && normalization?.durationSeconds?.supportedValues) {
    metadata.supportedDurationSeconds = [...normalization.durationSeconds.supportedValues];
  }
  return metadata;
}

function isAbortLikeError(error: string | undefined): boolean {
  return Boolean(error && /aborted|abort|cancelled|canceled|timed out/i.test(error));
}

export function throwCapabilityGenerationFailure(params: {
  capabilityLabel: string;
  attempts: FallbackAttempt[];
  lastError: unknown;
}): never {
  if (params.attempts.length === 0) {
    throw params.lastError instanceof Error
      ? params.lastError
      : new Error(formatErrorMessage(params.lastError));
  }
  const nonAbortAttempts = params.attempts.filter((attempt) => !isAbortLikeError(attempt.error));
  const abortAttempts = params.attempts.filter((attempt) => isAbortLikeError(attempt.error));
  const parts = nonAbortAttempts.map(
    (attempt) => `${attempt.provider}/${attempt.model}: ${attempt.error}`,
  );
  if (abortAttempts.length > 0) {
    parts.push(
      `${abortAttempts.length} fallback(s) aborted after the request was cancelled or timed out: ${abortAttempts
        .map((attempt) => `${attempt.provider}/${attempt.model}`)
        .join(", ")}`,
    );
  }
  throw new Error(
    `All ${params.capabilityLabel} models failed (${params.attempts.length}): ${parts.join(" | ")}`,
  );
}
