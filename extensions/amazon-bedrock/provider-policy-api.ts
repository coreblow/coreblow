import { normalizeProviderId } from "coreblow/plugin-sdk/provider-model-shared";
import { resolveBedrockClaudeThinkingProfile } from "./thinking-policy.js";

export function resolveThinkingProfile(params: { provider: string; modelId: string }) {
  const provider = normalizeProviderId(params.provider);
  if (provider !== "amazon-bedrock" && provider !== "bedrock" && provider !== "aws-bedrock") {
    return null;
  }
  return resolveBedrockClaudeThinkingProfile(params.modelId);
}
