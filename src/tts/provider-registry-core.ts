import type { CoreBlowConfig } from "../config/config.js";
import type { SpeechProviderPlugin } from "../plugins/types.js";
import type { SpeechProviderId } from "./provider-types.js";
import {
  canonicalizeSpeechProviderId,
  getSpeechProvider,
  listSpeechProviders,
  normalizeSpeechProviderId,
} from "./provider-registry.js";

export type SpeechProviderRegistryResolver = {
  getProvider: (providerId: string, cfg?: CoreBlowConfig) => SpeechProviderPlugin | undefined;
  listProviders: (cfg?: CoreBlowConfig) => SpeechProviderPlugin[];
};

export { normalizeSpeechProviderId };

export function createSpeechProviderRegistry(resolver: SpeechProviderRegistryResolver) {
  return {
    canonicalizeSpeechProviderId: (
      providerId: string | undefined,
      cfg?: CoreBlowConfig,
    ): SpeechProviderId | undefined => {
      const normalized = normalizeSpeechProviderId(providerId);
      if (!normalized) {
        return undefined;
      }
      return resolver.getProvider(normalized, cfg)?.id ?? normalized;
    },
    getSpeechProvider: resolver.getProvider,
    listSpeechProviders: resolver.listProviders,
  };
}

export const defaultSpeechProviderRegistry = {
  canonicalizeSpeechProviderId,
  getSpeechProvider,
  listSpeechProviders,
};
