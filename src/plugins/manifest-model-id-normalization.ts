import type { CoreBlowConfig } from "../config/config.js";
import { normalizeLowercaseStringOrEmpty } from "../shared/string-coerce.js";
import { getCurrentPluginMetadataSnapshot } from "./current-plugin-metadata-snapshot.js";
import type { PluginManifestRecord } from "./manifest-registry.js";
import type { PluginManifestModelIdNormalizationProvider } from "./manifest.js";
import {
  loadPluginMetadataSnapshot,
  type PluginMetadataSnapshot,
} from "./plugin-metadata-snapshot.js";
import { getActivePluginRegistryWorkspaceDirFromState } from "./runtime-state.js";

type ManifestModelIdNormalizationLookupParams = {
  config?: CoreBlowConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  plugins?: readonly Pick<PluginManifestRecord, "modelIdNormalization">[];
};

type ManifestModelIdNormalizationPolicyCache = {
  configFingerprint: string;
  policies: Map<string, PluginManifestModelIdNormalizationProvider>;
};

let cachedPolicies: ManifestModelIdNormalizationPolicyCache | undefined;

function hasProviderPrefix(modelId: string): boolean {
  return modelId.includes("/");
}

function formatPrefixedModelId(prefix: string, modelId: string): string {
  return `${prefix.replace(/\/+$/u, "")}/${modelId.replace(/^\/+/u, "")}`;
}

/**
 * Service managing manifest-declared model id normalization rules.
 */
export class ManifestModelIdNormalizationService {
  public static collectPolicies(
    plugins: readonly Pick<PluginManifestRecord, "modelIdNormalization">[],
  ): Map<string, PluginManifestModelIdNormalizationProvider> {
    const policies = new Map<string, PluginManifestModelIdNormalizationProvider>();
    for (const plugin of plugins) {
      for (const [provider, policy] of Object.entries(plugin.modelIdNormalization?.providers ?? {})) {
        policies.set(normalizeLowercaseStringOrEmpty(provider), policy);
      }
    }
    return policies;
  }

  public static resolveSnapshotForPolicies(
    params: ManifestModelIdNormalizationLookupParams = {},
  ): {
    snapshot: PluginMetadataSnapshot;
    cacheable: boolean;
  } {
    const env = params.env ?? process.env;
    const workspaceDir = params.workspaceDir ?? getActivePluginRegistryWorkspaceDirFromState();
    const current = getCurrentPluginMetadataSnapshot({
      config: params.config,
      env,
      workspaceDir,
    });
    if (current) {
      return { snapshot: current, cacheable: true };
    }
    return {
      snapshot: loadPluginMetadataSnapshot({
        config: params.config ?? {},
        env,
        workspaceDir,
      }),
      cacheable: false,
    };
  }

  public static loadPolicies(
    params: ManifestModelIdNormalizationLookupParams = {},
  ): Map<string, PluginManifestModelIdNormalizationProvider> {
    if (params.plugins) {
      return this.collectPolicies(params.plugins);
    }
    const { snapshot, cacheable } = this.resolveSnapshotForPolicies(params);
    const configFingerprint = snapshot.configFingerprint;
    if (cacheable && configFingerprint && cachedPolicies?.configFingerprint === configFingerprint) {
      return cachedPolicies.policies;
    }
    const policies = this.collectPolicies(snapshot.plugins);
    if (cacheable && configFingerprint) {
      cachedPolicies = { configFingerprint, policies };
    }
    return policies;
  }

  public static resolvePolicy(
    provider: string,
    params: ManifestModelIdNormalizationLookupParams = {},
  ): PluginManifestModelIdNormalizationProvider | undefined {
    const providerId = normalizeLowercaseStringOrEmpty(provider);
    return this.loadPolicies(params).get(providerId);
  }

  public static normalize(params: {
    provider: string;
    config?: CoreBlowConfig;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
    plugins?: readonly Pick<PluginManifestRecord, "modelIdNormalization">[];
    context: {
      provider: string;
      modelId: string;
    };
  }): string | undefined {
    const policy = this.resolvePolicy(params.provider, params);
    if (!policy) {
      return undefined;
    }

    let modelId = params.context.modelId.trim();
    if (!modelId) {
      return modelId;
    }

    for (const prefix of policy.stripPrefixes ?? []) {
      const normalizedPrefix = normalizeLowercaseStringOrEmpty(prefix);
      if (normalizedPrefix && normalizeLowercaseStringOrEmpty(modelId).startsWith(normalizedPrefix)) {
        modelId = modelId.slice(prefix.length);
        break;
      }
    }

    modelId = policy.aliases?.[normalizeLowercaseStringOrEmpty(modelId)] ?? modelId;

    if (!hasProviderPrefix(modelId)) {
      for (const rule of policy.prefixWhenBareAfterAliasStartsWith ?? []) {
        if (normalizeLowercaseStringOrEmpty(modelId).startsWith(rule.modelPrefix.toLowerCase())) {
          return formatPrefixedModelId(rule.prefix, modelId);
        }
      }
      if (policy.prefixWhenBare) {
        return formatPrefixedModelId(policy.prefixWhenBare, modelId);
      }
    }

    return modelId;
  }
}

export function normalizeProviderModelIdWithManifest(params: {
  provider: string;
  config?: CoreBlowConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  plugins?: readonly Pick<PluginManifestRecord, "modelIdNormalization">[];
  context: {
    provider: string;
    modelId: string;
  };
}): string | undefined {
  return ManifestModelIdNormalizationService.normalize(params);
}
