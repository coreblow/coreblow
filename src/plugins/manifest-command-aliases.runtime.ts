import type { CoreBlowConfig } from "../config/config.js";
import { normalizeOptionalLowercaseString } from "../shared/string-coerce.js";
import { resolveManifestActivationPluginIds } from "./activation-planner.js";
import {
  resolveManifestCommandAliasOwnerInRegistry,
  resolveManifestToolOwnerInRegistry,
  type PluginManifestCommandAliasRegistry,
  type PluginManifestCommandAliasRecord,
  type PluginManifestToolOwnerRecord,
} from "./manifest-command-aliases.js";
import {
  isManifestPluginAvailableForControlPlane,
  loadManifestMetadataRegistry,
  loadManifestMetadataSnapshot,
} from "./manifest-contract-eligibility.js";
import { hasManifestToolAvailability } from "./manifest-tool-availability.js";

/**
 * Enterprise service resolving command aliases and tool owners at runtime.
 */
export class ManifestCommandAliasRuntimeResolver {
  public static resolveCommandAliasOwner(params: {
    command: string | undefined;
    config?: CoreBlowConfig;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
    registry?: PluginManifestCommandAliasRegistry;
  }): PluginManifestCommandAliasRecord | undefined {
    const registry =
      params.registry ??
      loadManifestMetadataRegistry({
        config: params.config,
        workspaceDir: params.workspaceDir,
        env: params.env,
      }).manifestRegistry;
    return resolveManifestCommandAliasOwnerInRegistry({
      command: params.command,
      registry,
    });
  }

  public static resolveCliCommandSurfaceOwner(params: {
    command: string | undefined;
    config?: CoreBlowConfig;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
    registry?: PluginManifestCommandAliasRegistry;
  }): string | undefined {
    const normalizedCommand = normalizeOptionalLowercaseString(params.command);
    if (!normalizedCommand) {
      return undefined;
    }
    if (params.registry) {
      return resolveManifestCommandAliasOwnerInRegistry({
        command: normalizedCommand,
        registry: params.registry,
      })?.pluginId;
    }
    return resolveManifestActivationPluginIds({
      trigger: { kind: "command", command: normalizedCommand },
      config: params.config,
      workspaceDir: params.workspaceDir,
      env: params.env,
    })[0];
  }

  public static resolveToolOwner(params: {
    toolName: string | undefined;
    config?: CoreBlowConfig;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
    registry?: PluginManifestCommandAliasRegistry;
  }): PluginManifestToolOwnerRecord | undefined {
    if (params.registry) {
      return resolveManifestToolOwnerInRegistry({
        toolName: params.toolName,
        registry: params.registry,
      });
    }
    const normalizedToolName = normalizeOptionalLowercaseString(params.toolName);
    if (!normalizedToolName) {
      return undefined;
    }
    const snapshot = loadManifestMetadataSnapshot({
      config: params.config,
      workspaceDir: params.workspaceDir,
      env: params.env,
    });
    const env = params.env ?? process.env;
    for (const plugin of snapshot.plugins) {
      const tools = plugin.contracts?.tools;
      if (!tools || tools.length === 0) {
        continue;
      }
      const match = tools.find(
        (entry) => normalizeOptionalLowercaseString(entry) === normalizedToolName,
      );
      if (!match) {
        continue;
      }
      const pluginAvailable = isManifestPluginAvailableForControlPlane({
        snapshot,
        plugin,
        config: params.config,
      });
      if (!pluginAvailable) {
        continue;
      }
      const toolAvailable = hasManifestToolAvailability({
        plugin,
        toolNames: [match],
        config: params.config,
        env,
      });
      return {
        toolName: match,
        pluginId: plugin.id,
        availability: toolAvailable ? "loaded" : "manifest-only",
      };
    }
    return undefined;
  }
}

export function resolveManifestCommandAliasOwner(params: {
  command: string | undefined;
  config?: CoreBlowConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  registry?: PluginManifestCommandAliasRegistry;
}): PluginManifestCommandAliasRecord | undefined {
  return ManifestCommandAliasRuntimeResolver.resolveCommandAliasOwner(params);
}

export function resolveManifestCliCommandSurfaceOwner(params: {
  command: string | undefined;
  config?: CoreBlowConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  registry?: PluginManifestCommandAliasRegistry;
}): string | undefined {
  return ManifestCommandAliasRuntimeResolver.resolveCliCommandSurfaceOwner(params);
}

export function resolveManifestToolOwner(params: {
  toolName: string | undefined;
  config?: CoreBlowConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  registry?: PluginManifestCommandAliasRegistry;
}): PluginManifestToolOwnerRecord | undefined {
  return ManifestCommandAliasRuntimeResolver.resolveToolOwner(params);
}
