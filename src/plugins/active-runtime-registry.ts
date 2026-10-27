import { resolveRuntimePluginRegistry, type PluginLoadOptions } from "./loader.js";
import type { PluginRegistry } from "./registry-types.js";
import {
  getActivePluginChannelRegistry,
  getActivePluginHttpRouteRegistry,
  getActivePluginRegistry,
} from "./runtime.js";
import { getActivePluginRegistryWorkspaceDirFromState } from "./runtime-state.js";

export type ActiveRuntimePluginRegistrySurface = "active" | "channel" | "http-route";

function normalizeRequiredPluginIds(ids?: readonly string[]): string[] | undefined {
  if (ids === undefined) {
    return undefined;
  }
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].toSorted((left, right) =>
    left.localeCompare(right),
  );
}

function registryContainsPluginIds(
  registry: PluginRegistry,
  pluginIds: readonly string[] | undefined,
): boolean {
  if (pluginIds === undefined) {
    return true;
  }
  const loaded = new Set<string>();
  for (const plugin of registry.plugins ?? []) {
    if (plugin.status === undefined || plugin.status === "loaded") {
      loaded.add(plugin.id);
    }
  }
  for (const value of Object.values(registry)) {
    if (!Array.isArray(value)) {
      continue;
    }
    for (const entry of value) {
      if (entry && typeof entry === "object" && "pluginId" in entry) {
        const pluginId = (entry as { pluginId: unknown }).pluginId;
        if (typeof pluginId === "string" && pluginId.length > 0) {
          loaded.add(pluginId);
        }
      }
    }
  }
  if (pluginIds.length === 0) {
    return loaded.size === 0;
  }
  return pluginIds.every((pluginId) => loaded.has(pluginId));
}

function resolveSurfaceRegistry(
  surface: ActiveRuntimePluginRegistrySurface,
): PluginRegistry | null {
  switch (surface) {
    case "active":
      return getActivePluginRegistry();
    case "channel":
      return getActivePluginChannelRegistry();
    case "http-route":
      return getActivePluginHttpRouteRegistry();
  }
  return null;
}

/**
 * Service class for accessing and resolving active runtime plugin registries.
 */
export class ActiveRuntimePluginRegistryService {
  public static getActive(): PluginRegistry | null {
    return getActivePluginRegistry();
  }

  public static getLoaded(
    params: {
      env?: NodeJS.ProcessEnv;
      loadOptions?: PluginLoadOptions;
      workspaceDir?: string;
      requiredPluginIds?: readonly string[];
      surface?: ActiveRuntimePluginRegistrySurface;
    } = {},
  ): PluginRegistry | undefined {
    const surface = params.surface ?? "active";
    const requiredPluginIds = normalizeRequiredPluginIds(
      params.requiredPluginIds ?? params.loadOptions?.onlyPluginIds,
    );
    if (surface === "active" && params.loadOptions && requiredPluginIds?.length !== 0) {
      const compatible = resolveRuntimePluginRegistry(params.loadOptions);
      if (!compatible || !registryContainsPluginIds(compatible, requiredPluginIds)) {
        return undefined;
      }
      return compatible;
    }

    const activeWorkspaceDir = getActivePluginRegistryWorkspaceDirFromState();
    const requestedWorkspaceDir = params.workspaceDir ?? params.loadOptions?.workspaceDir;
    if (requestedWorkspaceDir !== undefined && activeWorkspaceDir !== requestedWorkspaceDir) {
      return undefined;
    }
    const registry = resolveSurfaceRegistry(surface);
    if (!registry) {
      return undefined;
    }
    if (!registryContainsPluginIds(registry, requiredPluginIds)) {
      return undefined;
    }
    return registry;
  }
}

export function getActiveRuntimePluginRegistry(): PluginRegistry | null {
  return ActiveRuntimePluginRegistryService.getActive();
}

export function getLoadedRuntimePluginRegistry(
  params: {
    env?: NodeJS.ProcessEnv;
    loadOptions?: PluginLoadOptions;
    workspaceDir?: string;
    requiredPluginIds?: readonly string[];
    surface?: ActiveRuntimePluginRegistrySurface;
  } = {},
): PluginRegistry | undefined {
  return ActiveRuntimePluginRegistryService.getLoaded(params);
}
