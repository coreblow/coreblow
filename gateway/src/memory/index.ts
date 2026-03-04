/**
 * src/memory/index.ts
 * Memory system — public API
 */

export { MemoryManager, type MemoryConfig } from './manager.js';
export { VectorStore, type MemoryEntry, type SearchResult } from './vector-store.js';
export {
    createEmbeddingProvider,
    cosineSimilarity,
    OllamaEmbedding,
    OpenAIEmbedding,
    LocalEmbedding,
    type EmbeddingProvider,
} from './embeddings.js';
export { createMemoryTools } from './tools.js';
