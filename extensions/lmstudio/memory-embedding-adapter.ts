import type { MemoryEmbeddingProviderAdapter } from "coreblow/plugin-sdk/memory-core-host-engine-embeddings";
import {
  createLmstudioEmbeddingProvider,
  DEFAULT_LMSTUDIO_EMBEDDING_MODEL,
} from "./src/embedding-provider.js";

export const lmstudioMemoryEmbeddingProviderAdapter: MemoryEmbeddingProviderAdapter = {
  id: "lmstudio",
  defaultModel: DEFAULT_LMSTUDIO_EMBEDDING_MODEL,
  transport: "remote",
  allowExplicitWhenConfiguredAuto: true,
  create: async (options) => {
    const { provider, client } = await createLmstudioEmbeddingProvider({
      ...options,
      model: options.model || DEFAULT_LMSTUDIO_EMBEDDING_MODEL,
    });
    return {
      provider,
      runtime: {
        id: "lmstudio",
        inlineBatchTimeoutMs: 10 * 60_000,
        cacheKeyData: {
          provider: "lmstudio",
          baseUrl: client.baseUrl,
          model: client.model,
        },
      },
    };
  },
};
