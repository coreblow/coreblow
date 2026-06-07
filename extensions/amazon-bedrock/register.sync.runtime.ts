import {
  createBedrockNoCacheWrapper,
  isAnthropicBedrockModel,
} from "coreblow/plugin-sdk/provider-stream";
import { refreshAwsSharedConfigCacheForBedrock } from "./aws-credential-refresh.js";
import { mergeImplicitBedrockProvider, resolveBedrockConfigApiKey } from "./discovery-shared.js";
import { bedrockMemoryEmbeddingProviderAdapter } from "./memory-embedding-adapter.js";
import {
  isOpus47BedrockModelRef,
  resolveBedrockClaudeThinkingProfile,
} from "./thinking-policy.js";

export {
  bedrockMemoryEmbeddingProviderAdapter,
  createBedrockNoCacheWrapper,
  isAnthropicBedrockModel,
  isOpus47BedrockModelRef,
  mergeImplicitBedrockProvider,
  refreshAwsSharedConfigCacheForBedrock,
  resolveBedrockClaudeThinkingProfile,
  resolveBedrockConfigApiKey,
};
