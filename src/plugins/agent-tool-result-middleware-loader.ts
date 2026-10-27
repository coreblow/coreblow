import type { CoreBlowConfig } from "../config/types.coreblow.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { getLoadedRuntimePluginRegistry } from "./active-runtime-registry.js";
import type {
  AgentToolResultMiddleware,
  AgentToolResultMiddlewareRuntime,
} from "./agent-tool-result-middleware-types.js";
import {
  listAgentToolResultMiddlewares,
  normalizeAgentToolResultMiddlewareRuntimeIds,
} from "./agent-tool-result-middleware.js";
import { loadCoreBlowPlugins } from "./loader.js";
import { loadPluginManifestRegistry, type PluginManifestRegistry } from "./manifest-registry.js";

const log = createSubsystemLogger("plugins/agent-tool-result-middleware");

async function resolveRuntimeConfig(): Promise<CoreBlowConfig> {
  const { loadConfig } = await import("../config/config.js");
  return loadConfig();
}

function listMiddlewareOwnerPluginIds(params: {
  manifestRegistry: PluginManifestRegistry;
  runtime: AgentToolResultMiddlewareRuntime;
}): string[] {
  const pluginIds: string[] = [];
  for (const record of params.manifestRegistry.plugins) {
    if (record.origin !== "bundled") {
      continue;
    }
    const runtimes = normalizeAgentToolResultMiddlewareRuntimeIds(
      record.contracts?.agentToolResultMiddleware,
    );
    if (runtimes.includes(params.runtime) && !pluginIds.includes(record.id)) {
      pluginIds.push(record.id);
    }
  }
  return pluginIds;
}

/**
 * Service class for loading agent tool result middleware plugins.
 */
export class AgentToolResultMiddlewareLoader {
  public static async loadForRuntime(params: {
    runtime: AgentToolResultMiddlewareRuntime;
    config?: CoreBlowConfig;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
    manifestRegistry?: PluginManifestRegistry;
  }): Promise<AgentToolResultMiddleware[]> {
    const activeHandlers = listAgentToolResultMiddlewares(params.runtime);
    if (activeHandlers.length > 0) {
      return activeHandlers;
    }

    try {
      const config = params.config ?? (await resolveRuntimeConfig());
      const env = params.env ?? process.env;
      const manifestRegistry =
        params.manifestRegistry ??
        loadPluginManifestRegistry({
          config,
          workspaceDir: params.workspaceDir,
          env,
        });
      const pluginIds = listMiddlewareOwnerPluginIds({
        manifestRegistry,
        runtime: params.runtime,
      });
      if (pluginIds.length === 0) {
        return [];
      }

      const runtimeRegistry =
        getLoadedRuntimePluginRegistry({
          workspaceDir: params.workspaceDir,
          env,
          requiredPluginIds: pluginIds,
        }) ??
        loadCoreBlowPlugins({
          config,
          workspaceDir: params.workspaceDir,
          env,
          onlyPluginIds: pluginIds,
          activate: false,
        });

      return (runtimeRegistry.agentToolResultMiddlewares ?? [])
        .filter((entry) => entry.runtimes.includes(params.runtime))
        .map((entry) => entry.handler ?? entry.middleware);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      log.warn(`[${params.runtime}] failed to load tool result middleware plugins: ${detail}`);
      return listAgentToolResultMiddlewares(params.runtime);
    }
  }
}

export async function loadAgentToolResultMiddlewaresForRuntime(params: {
  runtime: AgentToolResultMiddlewareRuntime;
  config?: CoreBlowConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  manifestRegistry?: PluginManifestRegistry;
}): Promise<AgentToolResultMiddleware[]> {
  return AgentToolResultMiddlewareLoader.loadForRuntime(params);
}

export const testing = {
  listMiddlewareOwnerPluginIds,
};
export { testing as __testing };
