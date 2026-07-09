import { describe, expect, it } from "vitest";
import {
  providerContractLoadError,
  resolveProviderContractProvidersForPluginIds,
} from "../../plugins/contracts/registry.js";
import { resolveBundledExplicitProviderContractsFromPublicArtifacts } from "../../plugins/provider-contract-public-artifacts.js";
import type { ProviderPlugin } from "../provider-model-shared.js";
import { installProviderPluginContractSuite } from "./provider-contract-suites.js";

type ProviderContractEntry = {
  pluginId: string;
  provider: ProviderPlugin;
};

function providerMatchesManifestId(provider: ProviderPlugin, providerId: string): boolean {
  return (
    provider.id === providerId ||
    (provider.aliases ?? []).includes(providerId) ||
    (provider.hookAliases ?? []).includes(providerId)
  );
}

export function describeProviderContracts(pluginId: string) {
  let providerEntries: ProviderContractEntry[] | undefined;

  const resolveProviderEntriesSync = (): ProviderContractEntry[] => {
    if (providerEntries) {
      return providerEntries;
    }
    providerEntries = resolveProviderContractProvidersForPluginIds([pluginId]).map((provider) => ({
      pluginId,
      provider,
    }));
    return providerEntries;
  };

  describe(`${pluginId} provider contract registry load`, () => {
    it("loads bundled providers without import-time registry failure", () => {
      const providers = resolveProviderEntriesSync();
      expect(providerContractLoadError).toBeUndefined();
      expect(providers.length).toBeGreaterThan(0);
    });
  });

  for (const provider of resolveProviderEntriesSync()) {
    describe(`${pluginId}:${provider.provider.id} provider contract`, () => {
      installProviderPluginContractSuite({
        provider: () => {
          const entry = resolveProviderEntriesSync().find((e) =>
            providerMatchesManifestId(e.provider, provider.provider.id),
          );
          if (!entry) {
            throw new Error(`provider contract entry missing for ${pluginId}:${provider.provider.id}`);
          }
          return entry.provider;
        },
      });
    });
  }
}
