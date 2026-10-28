import type { CoreBlowConfig } from "../config/config.js";
import { getCurrentPluginMetadataSnapshot } from "./current-plugin-metadata-snapshot.js";
import { isInstalledPluginEnabled } from "./installed-plugin-index.js";
import type { PluginManifestContractListKey, PluginManifestRecord } from "./manifest-registry.js";
import { loadPluginMetadataSnapshot } from "./plugin-metadata-snapshot.js";
import type {
  PluginMetadataManifestView,
  PluginMetadataRegistryView,
  PluginMetadataSnapshot,
} from "./plugin-metadata-snapshot.types.js";

/**
 * Enterprise service governing plugin contract eligibility and control plane availability.
 */
export class ManifestContractEligibilityService {
  public static isManifestPluginAvailableForControlPlane(params: {
    snapshot: Pick<PluginMetadataSnapshot, "index">;
    plugin: Pick<
      PluginManifestRecord,
      "id" | "origin" | "enabledByDefault" | "enabledByDefaultOnPlatforms"
    >;
    config?: CoreBlowConfig;
  }): boolean {
    if (params.plugin.origin === "bundled") {
      return true;
    }
    return isInstalledPluginEnabled(params.snapshot.index, params.plugin.id, params.config);
  }

  public static hasManifestContractValue(params: {
    plugin: Pick<PluginManifestRecord, "contracts">;
    contract: PluginManifestContractListKey;
    value?: string;
  }): boolean {
    const values = params.plugin.contracts?.[params.contract] ?? [];
    return values.length > 0 && (!params.value || values.includes(params.value));
  }

  public static listAvailableManifestContractPlugins(params: {
    snapshot: Pick<PluginMetadataSnapshot, "index" | "plugins">;
    contract: PluginManifestContractListKey;
    value?: string;
    config?: CoreBlowConfig;
  }): PluginManifestRecord[] {
    return params.snapshot.plugins.filter(
      (plugin) =>
        this.hasManifestContractValue({
          plugin,
          contract: params.contract,
          value: params.value,
        }) &&
        this.isManifestPluginAvailableForControlPlane({
          snapshot: params.snapshot,
          plugin,
          config: params.config,
        }),
    );
  }

  public static listAvailableManifestContractValues(params: {
    snapshot: Pick<PluginMetadataSnapshot, "index" | "plugins">;
    contract: PluginManifestContractListKey;
    config?: CoreBlowConfig;
  }): string[] {
    const values = new Set<string>();
    for (const plugin of this.listAvailableManifestContractPlugins(params)) {
      for (const value of plugin.contracts?.[params.contract] ?? []) {
        values.add(value);
      }
    }
    return [...values].toSorted((left, right) => left.localeCompare(right));
  }

  public static loadManifestContractSnapshot(params: {
    config?: CoreBlowConfig;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
  }): PluginMetadataManifestView {
    const snapshot = this.loadManifestMetadataSnapshot(params);
    return {
      index: snapshot.index,
      plugins: snapshot.plugins,
    };
  }

  public static loadManifestMetadataRegistry(params: {
    config?: CoreBlowConfig;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
  }): PluginMetadataRegistryView {
    const snapshot = this.loadManifestMetadataSnapshot(params);
    return {
      index: snapshot.index,
      manifestRegistry: snapshot.manifestRegistry,
    };
  }

  public static loadManifestMetadataSnapshot(params: {
    config?: CoreBlowConfig;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
  }): PluginMetadataSnapshot {
    const config = params.config ?? {};
    const env = params.env ?? process.env;
    const current = getCurrentPluginMetadataSnapshot({
      config,
      env,
      ...(params.workspaceDir ? { workspaceDir: params.workspaceDir } : {}),
      ...(params.workspaceDir === undefined ? { allowWorkspaceScopedSnapshot: true } : {}),
    });
    if (current) {
      return current;
    }
    return loadPluginMetadataSnapshot({
      config,
      env,
      ...(params.workspaceDir ? { workspaceDir: params.workspaceDir } : {}),
    });
  }
}

export function isManifestPluginAvailableForControlPlane(params: {
  snapshot: Pick<PluginMetadataSnapshot, "index">;
  plugin: Pick<
    PluginManifestRecord,
    "id" | "origin" | "enabledByDefault" | "enabledByDefaultOnPlatforms"
  >;
  config?: CoreBlowConfig;
}): boolean {
  return ManifestContractEligibilityService.isManifestPluginAvailableForControlPlane(params);
}

export function hasManifestContractValue(params: {
  plugin: Pick<PluginManifestRecord, "contracts">;
  contract: PluginManifestContractListKey;
  value?: string;
}): boolean {
  return ManifestContractEligibilityService.hasManifestContractValue(params);
}

export function listAvailableManifestContractPlugins(params: {
  snapshot: Pick<PluginMetadataSnapshot, "index" | "plugins">;
  contract: PluginManifestContractListKey;
  value?: string;
  config?: CoreBlowConfig;
}): PluginManifestRecord[] {
  return ManifestContractEligibilityService.listAvailableManifestContractPlugins(params);
}

export function listAvailableManifestContractValues(params: {
  snapshot: Pick<PluginMetadataSnapshot, "index" | "plugins">;
  contract: PluginManifestContractListKey;
  config?: CoreBlowConfig;
}): string[] {
  return ManifestContractEligibilityService.listAvailableManifestContractValues(params);
}

export function loadManifestContractSnapshot(params: {
  config?: CoreBlowConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
}): PluginMetadataManifestView {
  return ManifestContractEligibilityService.loadManifestContractSnapshot(params);
}

export function loadManifestMetadataRegistry(params: {
  config?: CoreBlowConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
}): PluginMetadataRegistryView {
  return ManifestContractEligibilityService.loadManifestMetadataRegistry(params);
}

export function loadManifestMetadataSnapshot(params: {
  config?: CoreBlowConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
}): PluginMetadataSnapshot {
  return ManifestContractEligibilityService.loadManifestMetadataSnapshot(params);
}
