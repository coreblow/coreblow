import { normalizeProviderModelIdWithManifest } from "../plugins/manifest-model-id-normalization.js";
import type { PluginManifestRecord } from "../plugins/manifest-registry.js";
import { normalizeGoogleModelId } from "../plugin-sdk/google.js";
import { normalizeXaiModelId } from "../plugin-sdk/xai.js";
import { normalizeLowercaseStringOrEmpty } from "../shared/string-coerce.js";
import { modelKey as sharedModelKey } from "./model-ref-shared.js";
import {
  findNormalizedProviderKey,
  findNormalizedProviderValue,
  normalizeProviderId,
  normalizeProviderIdForAuth,
} from "./provider-id.js";
import { normalizeProviderModelIdWithRuntime } from "./provider-model-normalization.runtime.js";

export type ModelRef = {
  provider: string;
  model: string;
};

export type ModelManifestNormalizationContext = {
  manifestPlugins?: readonly Pick<PluginManifestRecord, "modelIdNormalization">[];
};

export function modelKey(provider: string, model: string) {
  return sharedModelKey(provider, model);
}

export function legacyModelKey(provider: string, model: string): string | null {
  const providerId = provider.trim();
  const modelId = model.trim();
  if (!providerId || !modelId) {
    return null;
  }
  const rawKey = `${providerId}/${modelId}`;
  const canonicalKey = modelKey(providerId, modelId);
  return rawKey === canonicalKey ? null : rawKey;
}

export {
  findNormalizedProviderKey,
  findNormalizedProviderValue,
  normalizeProviderId,
  normalizeProviderIdForAuth,
};

function normalizeAnthropicModelId(model: string): string {
  const trimmed = model.trim();
  if (!trimmed) {
    return trimmed;
  }
  const lower = trimmed.toLowerCase();
  switch (lower) {
    case "opus-4.6":
      return "claude-opus-4-6";
    case "opus-4.5":
      return "claude-opus-4-5";
    case "sonnet-4.6":
      return "claude-sonnet-4-6";
    case "sonnet-4.5":
      return "claude-sonnet-4-5";
    default:
      return trimmed;
  }
}

function normalizeBuiltInProviderModel(provider: string, model: string): string {
  if (provider === "anthropic") {
    return normalizeAnthropicModelId(model);
  }
  if (provider === "google" || provider === "google-vertex" || provider === "googlevertex") {
    return normalizeGoogleModelId(model);
  }
  if (provider === "openai") {
    return model;
  }
  if (provider === "openrouter") {
    return model.includes("/") ? model : `openrouter/${model}`;
  }
  if (provider === "xai") {
    return normalizeXaiModelId(model);
  }
  if (provider === "vercel-ai-gateway" || provider === "vercelaigateway") {
    const anthropicPrefixMatch = model.match(/^anthropic\/(.+)$/);
    if (anthropicPrefixMatch) {
      return anthropicPrefixMatch[1];
    }
    if (!model.includes("/")) {
      const VERCEL_CLAUDE_SHORTHANDS: Record<string, string> = {
        "opus-4.6": "claude-opus-4.6",
        "opus-4.5": "claude-opus-4.5",
        "sonnet-4.6": "claude-sonnet-4.6",
        "sonnet-4.5": "claude-sonnet-4.5",
      };
      const vercelModel = VERCEL_CLAUDE_SHORTHANDS[model.toLowerCase()];
      if (vercelModel) {
        return vercelModel;
      }
      if (model.startsWith("claude-")) {
        return model;
      }
    }
  }
  return model;
}

function normalizeProviderModelId(
  provider: string,
  model: string,
  options?: ModelManifestNormalizationContext & {
    allowManifestNormalization?: boolean;
    allowPluginNormalization?: boolean;
  },
): string {
  const builtInModelId = normalizeBuiltInProviderModel(provider, model);
  const manifestModelId =
    options?.allowManifestNormalization !== false && options?.manifestPlugins
      ? normalizeProviderModelIdWithManifest({
          provider,
          plugins: options.manifestPlugins,
          context: {
            provider,
            modelId: builtInModelId,
          },
        }) ?? builtInModelId
      : builtInModelId;
  if (options?.allowPluginNormalization === false) {
    return manifestModelId;
  }
  return (
    normalizeProviderModelIdWithRuntime({
      provider,
      context: {
        provider,
        modelId: manifestModelId,
      },
    }) ?? manifestModelId
  );
}

type ModelRefNormalizeOptions = ModelManifestNormalizationContext & {
  allowManifestNormalization?: boolean;
  allowPluginNormalization?: boolean;
};

export function normalizeModelRef(
  provider: string,
  model: string,
  options?: ModelRefNormalizeOptions,
): ModelRef {
  const normalizedProvider = normalizeProviderId(provider);
  const normalizedModel =
    options?.allowPluginNormalization === false
      ? model.trim()
      : normalizeProviderModelId(normalizedProvider, model.trim(), options);
  return { provider: normalizedProvider, model: normalizedModel };
}

type ParseModelRefOptions = ModelRefNormalizeOptions;
const OPENROUTER_AUTO_COMPAT_ALIAS = "openrouter:auto";

export function parseModelRef(
  raw: string,
  defaultProvider: string,
  options?: ParseModelRefOptions,
): ModelRef | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (normalizeLowercaseStringOrEmpty(trimmed) === OPENROUTER_AUTO_COMPAT_ALIAS) {
    return normalizeModelRef("openrouter", "auto", options);
  }
  const slash = trimmed.indexOf("/");
  if (slash === -1) {
    return normalizeModelRef(defaultProvider, trimmed, options);
  }
  const providerRaw = trimmed.slice(0, slash).trim();
  const model = trimmed.slice(slash + 1).trim();
  if (!providerRaw || !model) {
    return null;
  }
  return normalizeModelRef(providerRaw, model, options);
}
