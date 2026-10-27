import { mergePluginTextTransforms } from "../agents/plugin-text-transforms.js";
import { getActiveRuntimePluginRegistry } from "./active-runtime-registry.js";
import type { PluginTextTransforms } from "./cli-backend.types.js";

/**
 * Resolver for runtime text transforms registered by active plugins.
 */
export class RuntimeTextTransformsResolver {
  public static resolve(): PluginTextTransforms | undefined {
    const registry = getActiveRuntimePluginRegistry();
    const pluginTextTransforms = Array.isArray(registry?.textTransforms)
      ? registry.textTransforms.map((entry) => entry.transforms)
      : [];
    return mergePluginTextTransforms(...pluginTextTransforms);
  }
}

export function resolveRuntimeTextTransforms(): PluginTextTransforms | undefined {
  return RuntimeTextTransformsResolver.resolve();
}
