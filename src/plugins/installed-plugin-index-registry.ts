import { normalizePluginsConfig } from "./config-state.js";
import { discoverCoreBlowPlugins, type PluginCandidate } from "./discovery.js";
import { loadInstalledPluginIndexInstallRecordsSync } from "./installed-plugin-index-record-reader.js";
import type { LoadInstalledPluginIndexParams } from "./installed-plugin-index-types.js";
import { loadPluginManifestRegistry, type PluginManifestRegistry } from "./manifest-registry.js";

export class InstalledPluginIndexRegistryResolver {
  public static resolve(params: LoadInstalledPluginIndexParams): {
    registry: PluginManifestRegistry;
    candidates: readonly PluginCandidate[];
  } {
    if (params.candidates) {
      return {
        candidates: params.candidates,
        registry: loadPluginManifestRegistry({
          config: params.config,
          workspaceDir: params.workspaceDir,
          env: params.env,
          candidates: params.candidates as PluginCandidate[],
          diagnostics: params.diagnostics as never,
        }),
      };
    }

    const normalized = normalizePluginsConfig(params.config?.plugins);
    const installRecords =
      params.installRecords ?? loadInstalledPluginIndexInstallRecordsSync({ env: params.env });
    const discovery = discoverCoreBlowPlugins({
      workspaceDir: params.workspaceDir,
      extraPaths: normalized.loadPaths,
      env: params.env,
    });
    return {
      candidates: discovery.candidates,
      registry: loadPluginManifestRegistry({
        config: params.config,
        workspaceDir: params.workspaceDir,
        env: params.env,
        candidates: discovery.candidates,
        diagnostics: discovery.diagnostics,
        installRecords,
      }),
    };
  }
}

export function resolveInstalledPluginIndexRegistry(params: LoadInstalledPluginIndexParams): {
  registry: PluginManifestRegistry;
  candidates: readonly PluginCandidate[];
} {
  return InstalledPluginIndexRegistryResolver.resolve(params);
}
