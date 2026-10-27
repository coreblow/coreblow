import { applyPluginAutoEnable } from "../config/plugin-auto-enable.js";
import type { CoreBlowConfig } from "../config/types.coreblow.js";
import {
  withBundledPluginAllowlistCompat,
  withBundledPluginEnablementCompat,
  withBundledPluginVitestCompat,
} from "./bundled-compat.js";
import {
  createPluginActivationSource,
  normalizePluginsConfig,
  type NormalizedPluginsConfig,
  type PluginActivationConfigSource,
} from "./config-state.js";
import { getCurrentPluginMetadataSnapshot } from "./current-plugin-metadata-snapshot.js";

export type PluginActivationCompatConfig = {
  allowlistPluginIds?: readonly string[];
  enablementPluginIds?: readonly string[];
  vitestPluginIds?: readonly string[];
};

export type PluginActivationBundledCompatMode = {
  allowlist?: boolean;
  enablement?: "always" | "allowlist";
  vitest?: boolean;
};

export type PluginActivationInputs = {
  rawConfig?: CoreBlowConfig;
  config?: CoreBlowConfig;
  normalized: NormalizedPluginsConfig;
  activationSourceConfig?: CoreBlowConfig;
  activationSource: PluginActivationConfigSource;
  autoEnabledReasons: Record<string, string[]>;
};

export type PluginActivationSnapshot = Pick<
  PluginActivationInputs,
  | "rawConfig"
  | "config"
  | "normalized"
  | "activationSourceConfig"
  | "activationSource"
  | "autoEnabledReasons"
>;

export type BundledPluginCompatibleActivationInputs = PluginActivationInputs & {
  compatPluginIds: string[];
};

export type BundledPluginCompatibleLoadValues = Pick<
  BundledPluginCompatibleActivationInputs,
  "rawConfig" | "config" | "activationSourceConfig" | "autoEnabledReasons" | "compatPluginIds"
>;

type BundledPluginCompatibleActivationParams = {
  rawConfig?: CoreBlowConfig;
  resolvedConfig?: CoreBlowConfig;
  autoEnabledReasons?: Record<string, string[]>;
  env?: NodeJS.ProcessEnv;
  workspaceDir?: string;
  onlyPluginIds?: readonly string[];
  applyAutoEnable?: boolean;
  compatMode: PluginActivationBundledCompatMode;
  resolveCompatPluginIds: (params: {
    config?: CoreBlowConfig;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
    onlyPluginIds?: readonly string[];
  }) => string[];
};

function shouldResolveBundledCompatPluginIds(params: {
  compatMode: PluginActivationBundledCompatMode;
  allowlistCompatEnabled: boolean;
}): boolean {
  return (
    params.allowlistCompatEnabled ||
    params.compatMode.enablement === "always" ||
    (params.compatMode.enablement === "allowlist" && params.allowlistCompatEnabled) ||
    params.compatMode.vitest === true
  );
}

function createBundledPluginCompatConfig(params: {
  compatMode: PluginActivationBundledCompatMode;
  allowlistCompatEnabled: boolean;
  compatPluginIds: string[];
}): PluginActivationCompatConfig {
  return {
    allowlistPluginIds: params.allowlistCompatEnabled ? params.compatPluginIds : undefined,
    enablementPluginIds:
      params.compatMode.enablement === "always" ||
      (params.compatMode.enablement === "allowlist" && params.allowlistCompatEnabled)
        ? params.compatPluginIds
        : undefined,
    vitestPluginIds: params.compatMode.vitest ? params.compatPluginIds : undefined,
  };
}

function applyPluginAutoEnableForActivation(params: {
  config: CoreBlowConfig;
  env: NodeJS.ProcessEnv;
  workspaceDir?: string;
}) {
  const currentSnapshot = getCurrentPluginMetadataSnapshot({
    config: params.config,
    env: params.env,
    workspaceDir: params.workspaceDir,
    allowWorkspaceScopedSnapshot: true,
  });
  const defaultDiscoverySnapshot =
    normalizePluginsConfig(params.config.plugins).loadPaths.length === 0
      ? getCurrentPluginMetadataSnapshot({
          env: params.env,
          workspaceDir: params.workspaceDir,
          allowWorkspaceScopedSnapshot: true,
          requireDefaultDiscoveryContext: true,
        })
      : undefined;
  const currentManifestRegistry =
    currentSnapshot?.manifestRegistry ?? defaultDiscoverySnapshot?.manifestRegistry;
  return applyPluginAutoEnable({
    config: params.config,
    env: params.env,
    ...(currentManifestRegistry ? { manifestRegistry: currentManifestRegistry } : {}),
  });
}

export class PluginActivationContextResolver {
  public static withActivatedPluginIds(params: {
    config?: CoreBlowConfig;
    pluginIds: readonly string[];
    overrideGlobalDisable?: boolean;
    overrideExplicitDisable?: boolean;
  }): CoreBlowConfig | undefined {
    if (params.pluginIds.length === 0) {
      return params.config;
    }
    const originalAllow = params.config?.plugins?.allow ?? [];
    const useAllowlistDiscovery =
      params.config?.plugins?.bundledDiscovery !== "compat" && originalAllow.length > 0;
    const originalAllowSet = useAllowlistDiscovery ? new Set(originalAllow) : undefined;
    const allow = new Set(originalAllow);
    const entries = {
      ...params.config?.plugins?.entries,
    };
    for (const pluginId of params.pluginIds) {
      const normalized = pluginId.trim();
      if (!normalized) {
        continue;
      }
      if (originalAllowSet && !originalAllowSet.has(normalized)) {
        continue;
      }
      allow.add(normalized);
      const existingEntry = entries[normalized];
      entries[normalized] = {
        ...existingEntry,
        enabled: existingEntry?.enabled !== false || params.overrideExplicitDisable === true,
      };
    }
    const forcePluginsEnabled =
      params.overrideGlobalDisable === true && params.config?.plugins?.enabled === false;
    return {
      ...params.config,
      plugins: {
        ...params.config?.plugins,
        ...(forcePluginsEnabled ? { enabled: true } : {}),
        ...(allow.size > 0 ? { allow: [...allow] } : {}),
        entries,
      },
    };
  }

  public static applyCompatibilityOverrides(params: {
    config?: CoreBlowConfig;
    compat?: PluginActivationCompatConfig;
    env: NodeJS.ProcessEnv;
  }): CoreBlowConfig | undefined {
    const allowlistCompat = params.compat?.allowlistPluginIds?.length
      ? withBundledPluginAllowlistCompat({
          config: params.config,
          pluginIds: params.compat.allowlistPluginIds,
        })
      : params.config;
    const enablementCompat = params.compat?.enablementPluginIds?.length
      ? withBundledPluginEnablementCompat({
          config: allowlistCompat,
          pluginIds: params.compat.enablementPluginIds,
        })
      : allowlistCompat;
    const vitestCompat = params.compat?.vitestPluginIds?.length
      ? withBundledPluginVitestCompat({
          config: enablementCompat,
          pluginIds: params.compat.vitestPluginIds,
          env: params.env,
        })
      : enablementCompat;
    return vitestCompat;
  }

  public static resolveActivationSnapshot(params: {
    rawConfig?: CoreBlowConfig;
    resolvedConfig?: CoreBlowConfig;
    autoEnabledReasons?: Record<string, string[]>;
    env?: NodeJS.ProcessEnv;
    workspaceDir?: string;
    applyAutoEnable?: boolean;
  }): PluginActivationSnapshot {
    const env = params.env ?? process.env;
    const rawConfig = params.rawConfig ?? params.resolvedConfig;
    let resolvedConfig = params.resolvedConfig ?? params.rawConfig;
    let autoEnabledReasons = params.autoEnabledReasons;

    if (params.applyAutoEnable && rawConfig !== undefined) {
      const autoEnabled = applyPluginAutoEnableForActivation({
        config: rawConfig,
        env,
        workspaceDir: params.workspaceDir,
      });
      resolvedConfig = autoEnabled.config;
      autoEnabledReasons = autoEnabled.autoEnabledReasons ?? {};
    }

    return {
      rawConfig,
      config: resolvedConfig,
      normalized: normalizePluginsConfig(resolvedConfig?.plugins),
      activationSourceConfig: rawConfig,
      activationSource: createPluginActivationSource({
        config: rawConfig,
      }),
      autoEnabledReasons: autoEnabledReasons ?? {},
    };
  }

  public static resolveActivationInputs(params: {
    rawConfig?: CoreBlowConfig;
    resolvedConfig?: CoreBlowConfig;
    autoEnabledReasons?: Record<string, string[]>;
    env?: NodeJS.ProcessEnv;
    workspaceDir?: string;
    compat?: PluginActivationCompatConfig;
    applyAutoEnable?: boolean;
  }): PluginActivationInputs {
    const env = params.env ?? process.env;
    const snapshot = PluginActivationContextResolver.resolveActivationSnapshot({
      rawConfig: params.rawConfig,
      resolvedConfig: params.resolvedConfig,
      autoEnabledReasons: params.autoEnabledReasons,
      env,
      workspaceDir: params.workspaceDir,
      applyAutoEnable: params.applyAutoEnable,
    });
    const config = PluginActivationContextResolver.applyCompatibilityOverrides({
      config: snapshot.config,
      compat: params.compat,
      env,
    });

    return {
      rawConfig: snapshot.rawConfig,
      config,
      normalized: normalizePluginsConfig(config?.plugins),
      activationSourceConfig: snapshot.activationSourceConfig,
      activationSource: snapshot.activationSource,
      autoEnabledReasons: snapshot.autoEnabledReasons,
    };
  }

  public static resolveBundledCompatibleActivationInputs(
    params: BundledPluginCompatibleActivationParams,
  ): BundledPluginCompatibleActivationInputs {
    const snapshot = PluginActivationContextResolver.resolveActivationSnapshot({
      rawConfig: params.rawConfig,
      resolvedConfig: params.resolvedConfig,
      autoEnabledReasons: params.autoEnabledReasons,
      env: params.env,
      workspaceDir: params.workspaceDir,
      applyAutoEnable: params.applyAutoEnable,
    });
    const allowlistCompatEnabled = params.compatMode.allowlist === true;
    const shouldResolveCompatPluginIds = shouldResolveBundledCompatPluginIds({
      compatMode: params.compatMode,
      allowlistCompatEnabled,
    });
    const compatPluginIds = shouldResolveCompatPluginIds
      ? params.resolveCompatPluginIds({
          config: snapshot.config,
          workspaceDir: params.workspaceDir,
          env: params.env,
          onlyPluginIds: params.onlyPluginIds,
        })
      : [];
    const activation = PluginActivationContextResolver.resolveActivationInputs({
      rawConfig: snapshot.rawConfig,
      resolvedConfig: snapshot.config,
      autoEnabledReasons: snapshot.autoEnabledReasons,
      env: params.env,
      workspaceDir: params.workspaceDir,
      compat: createBundledPluginCompatConfig({
        compatMode: params.compatMode,
        allowlistCompatEnabled,
        compatPluginIds,
      }),
    });

    return {
      ...activation,
      compatPluginIds,
    };
  }

  public static resolveBundledCompatibleLoadValues(
    params: BundledPluginCompatibleActivationParams,
  ): BundledPluginCompatibleLoadValues {
    const env = params.env ?? process.env;
    const rawConfig = params.rawConfig ?? params.resolvedConfig;
    let resolvedConfig = params.resolvedConfig ?? params.rawConfig;
    let autoEnabledReasons = params.autoEnabledReasons ?? {};

    if (params.applyAutoEnable && rawConfig !== undefined) {
      const autoEnabled = applyPluginAutoEnableForActivation({
        config: rawConfig,
        env,
        workspaceDir: params.workspaceDir,
      });
      resolvedConfig = autoEnabled.config;
      autoEnabledReasons = autoEnabled.autoEnabledReasons ?? {};
    }

    const allowlistCompatEnabled = params.compatMode.allowlist === true;
    const shouldResolveCompatPluginIds = shouldResolveBundledCompatPluginIds({
      compatMode: params.compatMode,
      allowlistCompatEnabled,
    });
    const compatPluginIds = shouldResolveCompatPluginIds
      ? params.resolveCompatPluginIds({
          config: resolvedConfig,
          workspaceDir: params.workspaceDir,
          env,
          onlyPluginIds: params.onlyPluginIds,
        })
      : [];
    const config = PluginActivationContextResolver.applyCompatibilityOverrides({
      config: resolvedConfig,
      compat: createBundledPluginCompatConfig({
        compatMode: params.compatMode,
        allowlistCompatEnabled,
        compatPluginIds,
      }),
      env,
    });

    return {
      rawConfig,
      config,
      activationSourceConfig: rawConfig,
      autoEnabledReasons,
      compatPluginIds,
    };
  }
}

export function withActivatedPluginIds(params: {
  config?: CoreBlowConfig;
  pluginIds: readonly string[];
  overrideGlobalDisable?: boolean;
  overrideExplicitDisable?: boolean;
}): CoreBlowConfig | undefined {
  return PluginActivationContextResolver.withActivatedPluginIds(params);
}

export function applyPluginCompatibilityOverrides(params: {
  config?: CoreBlowConfig;
  compat?: PluginActivationCompatConfig;
  env: NodeJS.ProcessEnv;
}): CoreBlowConfig | undefined {
  return PluginActivationContextResolver.applyCompatibilityOverrides(params);
}

export function resolvePluginActivationSnapshot(params: {
  rawConfig?: CoreBlowConfig;
  resolvedConfig?: CoreBlowConfig;
  autoEnabledReasons?: Record<string, string[]>;
  env?: NodeJS.ProcessEnv;
  workspaceDir?: string;
  applyAutoEnable?: boolean;
}): PluginActivationSnapshot {
  return PluginActivationContextResolver.resolveActivationSnapshot(params);
}

export function resolvePluginActivationInputs(params: {
  rawConfig?: CoreBlowConfig;
  resolvedConfig?: CoreBlowConfig;
  autoEnabledReasons?: Record<string, string[]>;
  env?: NodeJS.ProcessEnv;
  workspaceDir?: string;
  compat?: PluginActivationCompatConfig;
  applyAutoEnable?: boolean;
}): PluginActivationInputs {
  return PluginActivationContextResolver.resolveActivationInputs(params);
}

export function resolveBundledPluginCompatibleActivationInputs(
  params: BundledPluginCompatibleActivationParams,
): BundledPluginCompatibleActivationInputs {
  return PluginActivationContextResolver.resolveBundledCompatibleActivationInputs(params);
}

export function resolveBundledPluginCompatibleLoadValues(
  params: BundledPluginCompatibleActivationParams,
): BundledPluginCompatibleLoadValues {
  return PluginActivationContextResolver.resolveBundledCompatibleLoadValues(params);
}
