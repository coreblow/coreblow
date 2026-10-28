import { describe, expect, it } from "vitest";
import { loadPluginManifestRegistry, type PluginManifestRecord } from "../manifest-registry.js";
import { resolveManifestContractPluginIds } from "../plugin-registry.js";
import { BUNDLED_PLUGIN_CONTRACT_SNAPSHOTS } from "./inventory/bundled-capability-metadata.js";
import {
  pluginRegistrationContractRegistry,
  providerContractLoadError,
  providerContractPluginIds,
} from "./registry.js";
import { uniqueSortedStrings } from "./testkit.js";

describe("plugin contract registry", () => {
  function expectUniqueIds(ids: readonly string[]) {
    expect(ids).toEqual([...new Set(ids)]);
  }

  function expectRegistryPluginIds(params: {
    actualPluginIds: readonly string[];
    predicate: (plugin: PluginManifestRecord) => boolean;
  }) {
    expect(uniqueSortedStrings(params.actualPluginIds)).toEqual(
      resolveBundledManifestPluginIds(params.predicate),
    );
  }

  function resolveBundledManifestPluginIds(predicate: (plugin: PluginManifestRecord) => boolean) {
    const snapshotPluginIds = new Set(
      BUNDLED_PLUGIN_CONTRACT_SNAPSHOTS.map((entry) => entry.pluginId),
    );
    return loadPluginManifestRegistry({})
      .plugins.filter((plugin) => snapshotPluginIds.has(plugin.id) && predicate(plugin))
      .map((plugin) => plugin.id)
      .toSorted((left, right) => left.localeCompare(right));
  }

  it("loads bundled non-provider capability registries without import-time failure", () => {
    expect(providerContractLoadError).toBeUndefined();
    expect(Array.from(pluginRegistrationContractRegistry)).toStrictEqual(
      BUNDLED_PLUGIN_CONTRACT_SNAPSHOTS,
    );
  });

  it.each([
    {
      name: "does not duplicate bundled provider ids",
      ids: () => pluginRegistrationContractRegistry.flatMap((entry) => entry.providerIds),
    },
    {
      name: "does not duplicate bundled web fetch provider ids",
      ids: () => pluginRegistrationContractRegistry.flatMap((entry) => entry.webFetchProviderIds),
    },
    {
      name: "does not duplicate bundled web search provider ids",
      ids: () => pluginRegistrationContractRegistry.flatMap((entry) => entry.webSearchProviderIds),
    },
    {
      name: "does not duplicate bundled migration provider ids",
      ids: () => pluginRegistrationContractRegistry.flatMap((entry) => entry.migrationProviderIds),
    },
    {
      name: "does not duplicate bundled media provider ids",
      ids: () =>
        pluginRegistrationContractRegistry.flatMap((entry) => entry.mediaUnderstandingProviderIds),
    },
    {
      name: "does not duplicate bundled realtime transcription provider ids",
      ids: () =>
        pluginRegistrationContractRegistry.flatMap(
          (entry) => entry.realtimeTranscriptionProviderIds,
        ),
    },
    {
      name: "does not duplicate bundled realtime voice provider ids",
      ids: () =>
        pluginRegistrationContractRegistry.flatMap((entry) => entry.realtimeVoiceProviderIds),
    },
    {
      name: "does not duplicate bundled image-generation provider ids",
      ids: () =>
        pluginRegistrationContractRegistry.flatMap((entry) => entry.imageGenerationProviderIds),
    },
  ] as const)("$name", ({ ids }) => {
    expectUniqueIds(ids());
  });

  it("does not duplicate bundled speech provider ids", () => {
    expectUniqueIds(pluginRegistrationContractRegistry.flatMap((entry) => entry.speechProviderIds));
  });

  it("covers every bundled provider plugin discovered from manifests", () => {
    expectRegistryPluginIds({
      actualPluginIds: providerContractPluginIds,
      predicate: (plugin) => plugin.origin === "bundled" && plugin.providers.length > 0,
    });
  });

  it("covers every bundled speech plugin discovered from manifests", () => {
    expectRegistryPluginIds({
      actualPluginIds: pluginRegistrationContractRegistry
        .filter((entry) => entry.speechProviderIds.length > 0)
        .map((entry) => entry.pluginId),
      predicate: (plugin) =>
        plugin.origin === "bundled" && (plugin.contracts?.speechProviders?.length ?? 0) > 0,
    });
  });

  it("covers every bundled realtime voice plugin discovered from manifests", () => {
    expectRegistryPluginIds({
      actualPluginIds: pluginRegistrationContractRegistry
        .filter((entry) => entry.realtimeVoiceProviderIds.length > 0)
        .map((entry) => entry.pluginId),
      predicate: (plugin) =>
        plugin.origin === "bundled" && (plugin.contracts?.realtimeVoiceProviders?.length ?? 0) > 0,
    });
  });

  it("covers every bundled realtime transcription plugin discovered from manifests", () => {
    expectRegistryPluginIds({
      actualPluginIds: pluginRegistrationContractRegistry
        .filter((entry) => entry.realtimeTranscriptionProviderIds.length > 0)
        .map((entry) => entry.pluginId),
      predicate: (plugin) =>
        plugin.origin === "bundled" &&
        (plugin.contracts?.realtimeTranscriptionProviders?.length ?? 0) > 0,
    });
  });

  it("covers every bundled web fetch plugin from the shared resolver", () => {
    const bundledWebFetchPluginIds = resolveManifestContractPluginIds({
      contract: "webFetchProviders",
      origin: "bundled",
    });

    expect(
      uniqueSortedStrings(
        pluginRegistrationContractRegistry
          .filter((entry) => entry.webFetchProviderIds.length > 0)
          .map((entry) => entry.pluginId),
      ),
    ).toEqual(bundledWebFetchPluginIds);
  });

  it("covers every bundled web search plugin from the shared resolver", () => {
    const snapshotPluginIds = new Set(
      BUNDLED_PLUGIN_CONTRACT_SNAPSHOTS.map((entry) => entry.pluginId),
    );
    const bundledWebSearchPluginIds = resolveManifestContractPluginIds({
      contract: "webSearchProviders",
      origin: "bundled",
    }).filter((pluginId) => snapshotPluginIds.has(pluginId));

    expect(
      uniqueSortedStrings(
        pluginRegistrationContractRegistry
          .filter((entry) => entry.webSearchProviderIds.length > 0)
          .map((entry) => entry.pluginId),
      ),
    ).toEqual(bundledWebSearchPluginIds);
  });
});
