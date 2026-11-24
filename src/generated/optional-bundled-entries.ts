import {
  hasBundledPluginPublicSurfaceModule,
  loadBundledPluginPublicSurfaceModule,
  loadBundledPluginPublicSurfaceModuleSync,
} from "../plugin-sdk/facade-loader.js";

type DefaultModule<T> = {
  default?: T;
};

/** Load an optional bundled plugin entrypoint only when its extension artifact exists on disk. */
export async function loadOptionalBundledPluginModule<T extends object = Record<string, unknown>>(
  dirName: string,
  artifactBasename: string,
): Promise<DefaultModule<T>> {
  if (!hasBundledPluginPublicSurfaceModule({ dirName, artifactBasename })) {
    return {};
  }
  return await loadBundledPluginPublicSurfaceModule<DefaultModule<T>>({
    dirName,
    artifactBasename,
  });
}

/** Synchronously load an optional bundled channel entrypoint when present on disk. */
export function loadOptionalBundledChannelEntrySync<T = unknown>(
  dirName: string,
  artifactBasename: string,
): T | undefined {
  if (!hasBundledPluginPublicSurfaceModule({ dirName, artifactBasename })) {
    return undefined;
  }
  const mod = loadBundledPluginPublicSurfaceModuleSync<DefaultModule<T>>({
    dirName,
    artifactBasename,
  });
  return mod.default;
}
