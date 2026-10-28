import type { CoreBlowConfig } from "../config/config.js";
import {
  buildModelCatalogMergeKey,
  planManifestModelCatalogSuppressions,
  type ManifestModelCatalogSuppressionEntry,
} from "../model-catalog/index.js";
import { normalizeLowercaseStringOrEmpty } from "../shared/string-coerce.js";
import {
  isManifestPluginAvailableForControlPlane,
  loadManifestMetadataSnapshot,
} from "./manifest-contract-eligibility.js";

function buildManifestSuppressionError(params: {
  provider: string;
  modelId: string;
  reason?: string;
}): string {
  const ref = `${params.provider}/${params.modelId}`;
  return params.reason ? `Unknown model: ${ref}. ${params.reason}` : `Unknown model: ${ref}.`;
}

function normalizeSuppressionHost(host: string): string {
  return normalizeLowercaseStringOrEmpty(host).replace(/\.+$/, "");
}

function normalizeBaseUrlHost(baseUrl: string | null | undefined): string {
  const trimmed = baseUrl?.trim();
  if (!trimmed) {
    return "";
  }
  try {
    return normalizeSuppressionHost(new URL(trimmed).hostname);
  } catch {
    return "";
  }
}

function resolveConfiguredProviderValue(params: {
  provider: string;
  config?: CoreBlowConfig;
}): { api?: string; baseUrl?: string } | undefined {
  const providers = params.config?.models?.providers;
  if (!providers) {
    return undefined;
  }
  for (const [providerId, entry] of Object.entries(providers)) {
    if (normalizeLowercaseStringOrEmpty(providerId) !== params.provider) {
      continue;
    }
    return {
      api: normalizeLowercaseStringOrEmpty(entry?.api),
      baseUrl: typeof entry?.baseUrl === "string" ? entry.baseUrl : undefined,
    };
  }
  return undefined;
}

function manifestSuppressionMatchesConditions(params: {
  suppression: ManifestModelCatalogSuppressionEntry;
  provider: string;
  baseUrl?: string | null;
  config?: CoreBlowConfig;
}): boolean {
  const when = params.suppression.when;
  if (!when) {
    return true;
  }
  const configuredProvider = resolveConfiguredProviderValue({
    provider: params.provider,
    config: params.config,
  });
  if (when.providerConfigApiIn?.length) {
    const allowedApis = new Set(when.providerConfigApiIn.map(normalizeLowercaseStringOrEmpty));
    const effectiveApi = configuredProvider
      ? normalizeLowercaseStringOrEmpty(configuredProvider.api)
      : params.provider;
    if (!effectiveApi || !allowedApis.has(effectiveApi)) {
      return false;
    }
  }
  if (when.baseUrlHosts?.length) {
    const baseUrlHost = normalizeBaseUrlHost(params.baseUrl ?? configuredProvider?.baseUrl);
    if (!baseUrlHost) {
      return false;
    }
    const allowedHosts = new Set(when.baseUrlHosts.map(normalizeSuppressionHost));
    if (!allowedHosts.has(baseUrlHost)) {
      return false;
    }
  }
  return true;
}

/**
 * Enterprise service governing model catalog suppressions based on plugin manifests.
 */
export class ManifestModelSuppressionService {
  public static listSuppressions(params: {
    config?: CoreBlowConfig;
    workspaceDir?: string;
    env: NodeJS.ProcessEnv;
  }): readonly ManifestModelCatalogSuppressionEntry[] {
    const snapshot = loadManifestMetadataSnapshot({
      config: params.config,
      workspaceDir: params.workspaceDir,
      env: params.env,
    });
    const registry = {
      diagnostics: snapshot.diagnostics,
      plugins: snapshot.plugins.filter((plugin) =>
        isManifestPluginAvailableForControlPlane({
          snapshot,
          plugin,
          config: params.config,
        }),
      ),
    };
    const planned = planManifestModelCatalogSuppressions({ registry });
    return planned.suppressions;
  }

  public static buildResolver(params: {
    config?: CoreBlowConfig;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
  }) {
    const suppressions = this.listSuppressions({
      config: params.config,
      workspaceDir: params.workspaceDir,
      env: params.env ?? process.env,
    });

    return (input: {
      provider?: string | null;
      id?: string | null;
      baseUrl?: string | null;
      unconditionalOnly?: boolean;
    }) => {
      const provider = normalizeLowercaseStringOrEmpty(input.provider);
      const modelId = normalizeLowercaseStringOrEmpty(input.id);
      if (!provider || !modelId) {
        return undefined;
      }
      const mergeKey = buildModelCatalogMergeKey(provider, modelId);
      const suppression = suppressions.find(
        (entry) =>
          entry.mergeKey === mergeKey &&
          (!input.unconditionalOnly || !entry.when) &&
          manifestSuppressionMatchesConditions({
            suppression: entry,
            provider,
            baseUrl: input.baseUrl,
            config: params.config,
          }),
      );
      if (!suppression) {
        return undefined;
      }
      return {
        suppress: true,
        errorMessage: buildManifestSuppressionError({
          provider,
          modelId,
          reason: suppression.reason,
        }),
      };
    };
  }

  public static resolve(params: {
    provider?: string | null;
    id?: string | null;
    config?: CoreBlowConfig;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
    baseUrl?: string | null;
    unconditionalOnly?: boolean;
  }) {
    const resolver = this.buildResolver({
      config: params.config,
      workspaceDir: params.workspaceDir,
      env: params.env,
    });
    return resolver({
      provider: params.provider,
      id: params.id,
      baseUrl: params.baseUrl,
      unconditionalOnly: params.unconditionalOnly,
    });
  }
}

export function buildManifestBuiltInModelSuppressionResolver(params: {
  config?: CoreBlowConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
}) {
  return ManifestModelSuppressionService.buildResolver(params);
}

export function resolveManifestBuiltInModelSuppression(params: {
  provider?: string | null;
  id?: string | null;
  config?: CoreBlowConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  baseUrl?: string | null;
  unconditionalOnly?: boolean;
}) {
  return ManifestModelSuppressionService.resolve(params);
}
