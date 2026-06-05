export type {
  EmbeddingProvider,
  EmbeddingProviderFallback,
  EmbeddingProviderId,
  EmbeddingProviderOptions,
  EmbeddingProviderRequest,
  GeminiEmbeddingClient,
  MistralEmbeddingClient,
  OllamaEmbeddingClient,
  OpenAiEmbeddingClient,
  VoyageEmbeddingClient,
} from "./embeddings.js";
export type { EmbeddingInput } from "./embedding-inputs.js";
export type { GeminiTaskType } from "./embeddings-gemini.js";

export type EmbeddingProviderCallOptions = {
  signal?: AbortSignal;
};
