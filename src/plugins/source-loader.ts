import { withProfile } from "./plugin-load-profile.js";
import {
  createPluginModuleLoaderCache,
  getCachedPluginSourceModuleLoader,
} from "./plugin-module-loader-cache.js";

export type PluginSourceLoader = (modulePath: string) => unknown;

/**
 * Factory class for creating plugin source module loaders.
 */
export class PluginSourceLoaderFactory {
  public static create(): PluginSourceLoader {
    const loaders = createPluginModuleLoaderCache();
    return (modulePath: string) => {
      const sourceLoader = getCachedPluginSourceModuleLoader({
        cache: loaders,
        modulePath,
        importerUrl: import.meta.url,
        loaderFilename: import.meta.url,
      });
      // Direct source loads are not associated with a specific plugin id —
      // preserve the existing `plugin=(direct)` field used by tooling that
      // scrapes [plugin-load-profile] lines.
      return withProfile({ pluginId: "(direct)", source: modulePath }, "source-loader", () =>
        sourceLoader(modulePath),
      );
    };
  }
}

export function createPluginSourceLoader(): PluginSourceLoader {
  return PluginSourceLoaderFactory.create();
}
