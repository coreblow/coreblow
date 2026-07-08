import {
  normalizeLowercaseStringOrEmpty,
  normalizeOptionalLowercaseString,
} from "../../shared/string-coerce.js";

type AnthropicCacheRetentionFamily =
  | "anthropic-direct"
  | "anthropic-bedrock"
  | "custom-anthropic-api";

export function isAnthropicModelRef(modelId: string): boolean {
  return normalizeLowercaseStringOrEmpty(modelId).startsWith("anthropic/");
}

/** Matches Application Inference Profile ARNs across all AWS partitions with Bedrock. */
const BEDROCK_APP_INFERENCE_PROFILE_ARN_RE = /^arn:aws(-cn|-us-gov)?:bedrock:/;

export function isAnthropicBedrockModel(modelId: string): boolean {
  const normalized = normalizeLowercaseStringOrEmpty(modelId);

  // Direct Anthropic Claude model IDs and regional inference profiles
  if (normalized.includes("anthropic.claude") || normalized.includes("anthropic/claude")) {
    return true;
  }

  // Application Inference Profile ARN — detect Claude via profile ID segment.
  if (
    BEDROCK_APP_INFERENCE_PROFILE_ARN_RE.test(normalized) &&
    normalized.includes(":application-inference-profile/")
  ) {
    const profileId = normalized.split(":application-inference-profile/")[1] ?? "";
    return profileId.includes("claude");
  }

  return false;
}

export function isOpenRouterAnthropicModelRef(provider: string, modelId: string): boolean {
  return (
    normalizeOptionalLowercaseString(provider) === "openrouter" && isAnthropicModelRef(modelId)
  );
}

export function isAnthropicFamilyCacheTtlEligible(params: {
  provider: string;
  modelApi?: string;
  modelId: string;
}): boolean {
  const normalizedProvider = normalizeOptionalLowercaseString(params.provider);
  if (normalizedProvider === "anthropic" || normalizedProvider === "anthropic-vertex") {
    return true;
  }
  if (normalizedProvider === "amazon-bedrock") {
    return isAnthropicBedrockModel(params.modelId);
  }
  return params.modelApi === "anthropic-messages";
}

export function resolveAnthropicCacheRetentionFamily(params: {
  provider: string;
  modelApi?: string;
  modelId?: string;
  hasExplicitCacheConfig: boolean;
}): AnthropicCacheRetentionFamily | undefined {
  const normalizedProvider = normalizeOptionalLowercaseString(params.provider);
  if (normalizedProvider === "anthropic" || normalizedProvider === "anthropic-vertex") {
    return "anthropic-direct";
  }
  if (
    normalizedProvider === "amazon-bedrock" &&
    params.hasExplicitCacheConfig &&
    typeof params.modelId === "string"
  ) {
    if (isAnthropicBedrockModel(params.modelId)) {
      return "anthropic-bedrock";
    }
    if (
      BEDROCK_APP_INFERENCE_PROFILE_ARN_RE.test(normalizeLowercaseStringOrEmpty(params.modelId)) &&
      normalizeLowercaseStringOrEmpty(params.modelId).includes(":application-inference-profile/")
    ) {
      return "anthropic-bedrock";
    }
  }
  if (
    normalizedProvider !== "amazon-bedrock" &&
    params.hasExplicitCacheConfig &&
    params.modelApi === "anthropic-messages"
  ) {
    return "custom-anthropic-api";
  }
  return undefined;
}
