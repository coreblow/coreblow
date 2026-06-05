import { normalizeProviderId } from "../agents/provider-id.js";
import type { CoreBlowConfig } from "../config/config.js";
import { isBlockedObjectKey } from "../infra/prototype-keys.js";
import type { MusicGenerationProvider } from "./types.js";

const BUILTIN_MUSIC_GENERATION_PROVIDERS: readonly MusicGenerationProvider[] = [];
const UNSAFE_PROVIDER_IDS = new Set(["__proto__", "constructor", "prototype"]);

function normalizeMusicGenerationProviderId(id: string | undefined): string | undefined {
  const normalized = normalizeProviderId(id ?? "");
  if (!normalized || isBlockedObjectKey(normalized)) {
    return undefined;
  }
  return normalized;
}

function isSafeMusicGenerationProviderId(id: string | undefined): id is string {
  return Boolean(id && !UNSAFE_PROVIDER_IDS.has(id));
}

function resolvePluginMusicGenerationProviders(_cfg?: CoreBlowConfig): MusicGenerationProvider[] {
  return [];
}

function buildProviderMaps(cfg?: CoreBlowConfig): {
  canonical: Map<string, MusicGenerationProvider>;
  aliases: Map<string, MusicGenerationProvider>;
} {
  const canonical = new Map<string, MusicGenerationProvider>();
  const aliases = new Map<string, MusicGenerationProvider>();
  const register = (provider: MusicGenerationProvider) => {
    const id = normalizeMusicGenerationProviderId(provider.id);
    if (!isSafeMusicGenerationProviderId(id)) {
      return;
    }
    canonical.set(id, provider);
    aliases.set(id, provider);
    for (const alias of provider.aliases ?? []) {
      const normalizedAlias = normalizeMusicGenerationProviderId(alias);
      if (isSafeMusicGenerationProviderId(normalizedAlias)) {
        aliases.set(normalizedAlias, provider);
      }
    }
  };

  for (const provider of BUILTIN_MUSIC_GENERATION_PROVIDERS) {
    register(provider);
  }
  for (const provider of resolvePluginMusicGenerationProviders(cfg)) {
    register(provider);
  }

  return { canonical, aliases };
}

export function listMusicGenerationProviders(cfg?: CoreBlowConfig): MusicGenerationProvider[] {
  return [...buildProviderMaps(cfg).canonical.values()];
}

export function getMusicGenerationProvider(
  providerId: string | undefined,
  cfg?: CoreBlowConfig,
): MusicGenerationProvider | undefined {
  const normalized = normalizeMusicGenerationProviderId(providerId);
  if (!normalized) {
    return undefined;
  }
  return buildProviderMaps(cfg).aliases.get(normalized);
}
