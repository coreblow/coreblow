import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { loadPluginManifestRegistry } from "../plugins/manifest-registry.js";

type ContractManifest = {
  id?: string;
  providers?: string[];
  contracts?: {
    speechProviders?: string[];
    imageGenerationProviders?: string[];
    videoGenerationProviders?: string[];
    musicGenerationProviders?: string[];
  };
  providerAuthChoices?: Array<{ choiceId?: string }>;
};

function readLocalExtensionManifest(pluginId: string): ContractManifest | undefined {
  const manifestPath = path.join(process.cwd(), "extensions", pluginId, "coreblow.plugin.json");
  if (!fs.existsSync(manifestPath)) {
    return undefined;
  }
  return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as ContractManifest;
}

export function describePluginRegistrationContract(params: {
  pluginId: string;
  providerIds?: string[];
  speechProviderIds?: string[];
  imageGenerationProviderIds?: string[];
  videoGenerationProviderIds?: string[];
  musicGenerationProviderIds?: string[];
  requireGenerateImage?: boolean;
  requireGenerateVideo?: boolean;
  requireSpeechVoices?: boolean;
  manifestAuthChoice?: {
    pluginId?: string;
    choiceId: string;
    choiceLabel?: string;
    groupId?: string;
    groupLabel?: string;
    groupHint?: string;
  };
}): void {
  describe(`${params.pluginId} plugin registration contract`, () => {
    it("declares expected bundled manifest contracts", () => {
      const plugin = loadPluginManifestRegistry({ env: process.env }).plugins.find(
        (entry) => entry.id === params.pluginId,
      ) ?? readLocalExtensionManifest(params.pluginId);
      expect(plugin).toBeTruthy();
      expect(plugin?.providers ?? []).toEqual(params.providerIds ?? []);
      expect(plugin?.contracts?.speechProviders ?? []).toEqual(params.speechProviderIds ?? []);
      expect(plugin?.contracts?.imageGenerationProviders ?? []).toEqual(
        params.imageGenerationProviderIds ?? [],
      );
      expect(plugin?.contracts?.videoGenerationProviders ?? []).toEqual(
        params.videoGenerationProviderIds ?? [],
      );
      expect(plugin?.contracts?.musicGenerationProviders ?? []).toEqual(
        params.musicGenerationProviderIds ?? [],
      );
      if (params.manifestAuthChoice) {
        expect((plugin?.providerAuthChoices ?? []).some(
          (choice) => choice.choiceId === params.manifestAuthChoice?.choiceId,
        )).toBe(true);
      }
    });
  });
}

export {
  assertNoImportTimeSideEffects,
  createPluginRegistryFixture,
  registerProviders,
  registerTestPlugin,
  registerVirtualTestPlugin,
  requireProvider,
  uniqueSortedStrings,
} from "./test-helpers/contracts-testkit.js";
