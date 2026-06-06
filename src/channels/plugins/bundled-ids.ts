import { listChannelPluginCatalogEntries } from "./catalog.js";
import { resolveBundledChannelRootScope } from "./bundled-root.js";

export function listBundledChannelPluginIdsForRoot(
  _packageRoot: string,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  return listChannelPluginCatalogEntries({ env })
    .map((entry) => entry.pluginId)
    .filter((pluginId): pluginId is string => Boolean(pluginId))
    .toSorted((left, right) => left.localeCompare(right));
}

export function listBundledChannelIdsForRoot(
  _packageRoot: string,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  return listChannelPluginCatalogEntries({ env })
    .map((entry) => entry.id)
    .filter(Boolean)
    .toSorted((left, right) => left.localeCompare(right));
}

export function listBundledChannelPluginIds(env: NodeJS.ProcessEnv = process.env): string[] {
  return listBundledChannelPluginIdsForRoot(resolveBundledChannelRootScope(env).cacheKey, env);
}

export function listBundledChannelIds(env: NodeJS.ProcessEnv = process.env): string[] {
  return listBundledChannelIdsForRoot(resolveBundledChannelRootScope(env).cacheKey, env);
}
