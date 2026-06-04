import {
  createMistralEmbeddingProvider,
  DEFAULT_MISTRAL_EMBEDDING_MODEL,
  type MemoryEmbeddingProviderAdapter,
} from "coreblow/plugin-sdk/memory-core-host-engine-embeddings";

function formatErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isMissingEmbeddingApiKeyError(err: unknown): boolean {
  return formatErrorMessage(err).includes("No API key found for provider");
}

export const mistralMemoryEmbeddingProviderAdapter: MemoryEmbeddingProviderAdapter = {
  id: "mistral",
  defaultModel: DEFAULT_MISTRAL_EMBEDDING_MODEL,
  transport: "remote",
  autoSelectPriority: 50,
  allowExplicitWhenConfiguredAuto: true,
  shouldContinueAutoSelection: isMissingEmbeddingApiKeyError,
  create: async (options) => {
    const { provider, client } = await createMistralEmbeddingProvider({
      ...options,
      provider: "mistral",
      fallback: "none",
    });
    return {
      provider,
      runtime: {
        id: "mistral",
        cacheKeyData: {
          provider: "mistral",
          model: client.model,
        },
      },
    };
  },
};
