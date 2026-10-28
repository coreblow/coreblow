import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../../agents/agent-scope.js";
import { getRuntimeConfig } from "../../config/config.js";
import { applyPluginAutoEnable } from "../../config/plugin-auto-enable.js";
import type { CoreBlowConfig } from "../../config/config.js";
import { createSubsystemLogger } from "../../logging.js";
import { resolvePluginActivationSourceConfig } from "../activation-source-config.js";
import {
  getCurrentPluginMetadataSnapshot,
  setCurrentPluginMetadataSnapshot,
} from "../current-plugin-metadata-snapshot.js";
import type { PluginLoadOptions } from "../loader.js";
import type { PluginManifestRegistry } from "../manifest-registry.js";
import { loadPluginMetadataSnapshot } from "../plugin-metadata-snapshot.js";
import type { PluginLogger } from "../types.js";

const log = createSubsystemLogger("plugins");

export type PluginRuntimeLoadContext = {
  rawConfig: CoreBlowConfig;
  config: CoreBlowConfig;
  activationSourceConfig: CoreBlowConfig;
  autoEnabledReasons: Readonly<Record<string, string[]>>;
  workspaceDir: string | undefined;
  env: NodeJS.ProcessEnv;
  logger: PluginLogger;
  manifestRegistry?: PluginManifestRegistry;
};

export type PluginRuntimeResolvedLoadValues = {
  config?: CoreBlowConfig;
  activationSourceConfig?: CoreBlowConfig;
  autoEnabledReasons?: Readonly<Record<string, string[]>>;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  logger?: PluginLogger;
  manifestRegistry?: PluginManifestRegistry;
};

export type PluginRuntimeLoadContextOptions = {
  config?: CoreBlowConfig;
  activationSourceConfig?: CoreBlowConfig;
  env?: NodeJS.ProcessEnv;
  workspaceDir?: string;
  logger?: PluginLogger;
  manifestRegistry?: PluginManifestRegistry;
};

export function createPluginRuntimeLoaderLogger(): PluginLogger {
  return {
    info: (message) => log.info(message),
    warn: (message) => log.warn(message),
    error: (message) => log.error(message),
    debug: (message) => log.debug(message),
  };
}

/**
 * Enterprise load context resolver for plugin runtimes.
 */
export class PluginRuntimeLoadContextResolver {
  public static resolve(options?: PluginRuntimeLoadContextOptions): PluginRuntimeLoadContext {
    return resolvePluginRuntimeLoadContext(options);
  }

  public static buildLoadOptions(
    context: PluginRuntimeLoadContext,
    overrides?: Partial<PluginLoadOptions>,
  ): PluginLoadOptions {
    return buildPluginRuntimeLoadOptions(context, overrides);
  }

  public static buildLoadOptionsFromValues(
    values: PluginRuntimeResolvedLoadValues,
    overrides?: Partial<PluginLoadOptions>,
  ): PluginLoadOptions {
    return buildPluginRuntimeLoadOptionsFromValues(values, overrides);
  }
}

export function resolvePluginRuntimeLoadContext(
  options?: PluginRuntimeLoadContextOptions,
): PluginRuntimeLoadContext {
  const env = options?.env ?? process.env;
  const rawConfig = options?.config ?? getRuntimeConfig();
  const rawWorkspaceDir =
    options?.workspaceDir ?? resolveAgentWorkspaceDir(rawConfig, resolveDefaultAgentId(rawConfig));
  const metadataSnapshot = options?.manifestRegistry
    ? undefined
    : (getCurrentPluginMetadataSnapshot({
        config: rawConfig,
        env,
        workspaceDir: rawWorkspaceDir,
      }) ??
      loadPluginMetadataSnapshot({
        config: rawConfig,
        env,
        workspaceDir: rawWorkspaceDir,
      }));
  const manifestRegistry = options?.manifestRegistry ?? metadataSnapshot?.manifestRegistry;
  const activationSourceConfig = resolvePluginActivationSourceConfig({
    config: rawConfig,
    activationSourceConfig: options?.activationSourceConfig,
  });
  const autoEnabled = applyPluginAutoEnable({
    config: rawConfig,
    env,
    manifestRegistry,
  });
  const config = autoEnabled.config;
  const workspaceDir =
    options?.workspaceDir ?? resolveAgentWorkspaceDir(config, resolveDefaultAgentId(config));
  if (metadataSnapshot) {
    setCurrentPluginMetadataSnapshot(metadataSnapshot, {
      config: rawConfig,
      compatibleConfigs: [config, activationSourceConfig],
      env,
      workspaceDir,
    });
  }
  return {
    rawConfig,
    config,
    activationSourceConfig,
    autoEnabledReasons: autoEnabled.autoEnabledReasons ?? {},
    workspaceDir,
    env,
    logger: options?.logger ?? createPluginRuntimeLoaderLogger(),
    ...(manifestRegistry ? { manifestRegistry } : {}),
  };
}

export function buildPluginRuntimeLoadOptions(
  context: PluginRuntimeLoadContext,
  overrides?: Partial<PluginLoadOptions>,
): PluginLoadOptions {
  return buildPluginRuntimeLoadOptionsFromValues(context, overrides);
}

export function buildPluginRuntimeLoadOptionsFromValues(
  values: PluginRuntimeResolvedLoadValues,
  overrides?: Partial<PluginLoadOptions>,
): PluginLoadOptions {
  return {
    config: values.config,
    activationSourceConfig: values.activationSourceConfig,
    autoEnabledReasons: values.autoEnabledReasons,
    workspaceDir: values.workspaceDir,
    env: values.env,
    logger: values.logger,
    ...(values.manifestRegistry ? { manifestRegistry: values.manifestRegistry } : {}),
    ...overrides,
  };
}
