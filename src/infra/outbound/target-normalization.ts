import { getChannelPlugin, normalizeChannelId } from "../../channels/plugins/index.js";
import type { ChannelId } from "../../channels/plugins/types.js";
import { getActivePluginChannelRegistryVersion } from "../../plugins/runtime.js";

export function normalizeChannelTargetInput(raw: string): string {
  return raw.trim();
}

type TargetNormalizer = ((raw: string) => string | undefined) | undefined;
type TargetNormalizerCacheEntry = {
  version: number;
  normalizer: TargetNormalizer;
};

const targetNormalizerCacheByChannelId = new Map<string, TargetNormalizerCacheEntry>();

function resolveTargetNormalizer(channelId: ChannelId): TargetNormalizer {
  const version = getActivePluginChannelRegistryVersion();
  const cached = targetNormalizerCacheByChannelId.get(channelId);
  if (cached?.version === version) {
    return cached.normalizer;
  }
  const plugin = getChannelPlugin(channelId);
  const normalizer = plugin?.messaging?.normalizeTarget;
  targetNormalizerCacheByChannelId.set(channelId, {
    version,
    normalizer,
  });
  return normalizer;
}

export function normalizeTargetForProvider(provider: string, raw?: string): string | undefined {
  if (!raw) {
    return undefined;
  }
  const fallback = raw.trim() || undefined;
  if (!fallback) {
    return undefined;
  }
  const providerId = normalizeChannelId(provider);
  const normalizer = providerId ? resolveTargetNormalizer(providerId) : undefined;
  const normalized = normalizer?.(raw) ?? fallback;
  return normalized || undefined;
}

export function buildTargetResolverSignature(channel: ChannelId): string {
  const plugin = getChannelPlugin(channel);
  const resolver = plugin?.messaging?.targetResolver;
  const hint = resolver?.hint ?? "";
  const looksLike = resolver?.looksLikeId;
  const source = looksLike ? looksLike.toString() : "";
  return hashSignature(`${hint}|${source}`);
}

function hashSignature(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

// ---------------------------------------------------------------------------
// TargetNormalizationService — Tier-1 Standalone Singleton
// ---------------------------------------------------------------------------

import { createTestingHooks } from "../service-patterns.js";

export class TargetNormalizationService {
  normalizeChannelTargetInput(raw: string) {
    return normalizeChannelTargetInput(raw);
  }

  normalizeTargetForProvider(provider: string, raw?: string) {
    return normalizeTargetForProvider(provider, raw);
  }

  buildTargetResolverSignature(channel: Parameters<typeof buildTargetResolverSignature>[0]) {
    return buildTargetResolverSignature(channel);
  }
}

let _targetNormalizationInstance: TargetNormalizationService | null = null;

export function getTargetNormalizationService(): TargetNormalizationService {
  if (!_targetNormalizationInstance) {
    _targetNormalizationInstance = new TargetNormalizationService();
  }
  return _targetNormalizationInstance;
}

export const __testing_targetNormalization = createTestingHooks<TargetNormalizationService>(
  () => { _targetNormalizationInstance = null; },
  (svc) => { _targetNormalizationInstance = svc; },
);
