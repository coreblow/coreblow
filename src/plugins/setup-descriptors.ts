import type { PluginManifestRecord } from "./manifest-registry.js";

type SetupDescriptorRecord = Pick<PluginManifestRecord, "providers" | "cliBackends" | "setupSource">;

export function listSetupProviderIds(record: SetupDescriptorRecord): readonly string[] {
  return record.providers;
}

export function listSetupCliBackendIds(record: SetupDescriptorRecord): readonly string[] {
  return record.cliBackends;
}
