import {
  resolveConfiguredPluginAutoEnableCandidates,
  type PluginEnableChange,
} from "./plugin-auto-enable.js";
import type { CoreBlowConfig } from "./types.js";
import type { PluginManifestRegistry } from "../plugins/manifest-registry.js";

const EMPTY_PLUGIN_MANIFEST_REGISTRY: PluginManifestRegistry = {
  plugins: [],
  diagnostics: [],
};

export function detectPluginAutoEnableCandidates(params: {
  config?: CoreBlowConfig;
  env?: NodeJS.ProcessEnv;
  manifestRegistry?: PluginManifestRegistry;
}): PluginEnableChange[] {
  return resolveConfiguredPluginAutoEnableCandidates(
    params.config ?? {},
    params.env ?? process.env,
    params.manifestRegistry ?? EMPTY_PLUGIN_MANIFEST_REGISTRY,
  );
}
