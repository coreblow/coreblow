/**
 * tests/unit/embeddings.test.ts
 * Tests for the embedding engine
 */
import { describe, it, expect } from 'vitest';
import { LocalEmbedding, cosineSimilarity, createEmbeddingProvider } from '../../src/memory/embeddings.js';

describe('LocalEmbedding', () => {
    const embedder = new LocalEmbedding();

    it('should generate embeddings with correct dimensions', async () => {
        const vec = await embedder.embed('Hello world');
        expect(vec).toBeDefined();
        expect(vec.length).toBe(256);
    });

    it('should generate normalized vectors (L2 norm ≈ 1)', async () => {
        const vec = await embedder.embed('Test normalization');
        const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
        expect(norm).toBeCloseTo(1.0, 3);
    });

    it('should produce similar vectors for similar text', async () => {
        const v1 = await embedder.embed('I love programming in TypeScript');
        const v2 = await embedder.embed('I enjoy coding in TypeScript');
        const v3 = await embedder.embed('The weather is sunny today');
        const sim12 = cosineSimilarity(v1, v2);
        const sim13 = cosineSimilarity(v1, v3);
        expect(sim12).toBeGreaterThan(sim13);
    });

    it('should handle empty text gracefully', async () => {
        const vec = await embedder.embed('');
        expect(vec).toBeDefined();
        expect(vec.length).toBe(256);
    });

    it('should handle very long text', async () => {
        const longText = 'word '.repeat(10000);
        const vec = await embedder.embed(longText);
        expect(vec.length).toBe(256);
    });

    it('should batch embed multiple texts', async () => {
        const vecs = await embedder.embedBatch(['hello', 'world', 'test']);
        expect(vecs.length).toBe(3);
        vecs.forEach(v => expect(v.length).toBe(256));
    });

    it('should filter stop words', async () => {
        const v1 = await embedder.embed('the a an is are');
        // All stop words → should still produce a vector (zeros)
        expect(v1.length).toBe(256);
    });
});

describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
        const v = [1, 2, 3, 4, 5];
        expect(cosineSimilarity(v, v)).toBeCloseTo(1.0);
    });

    it('should return 0 for orthogonal vectors', () => {
        const v1 = [1, 0, 0];
        const v2 = [0, 1, 0];
        expect(cosineSimilarity(v1, v2)).toBeCloseTo(0.0);
    });

    it('should return -1 for opposite vectors', () => {
        const v1 = [1, 2, 3];
        const v2 = [-1, -2, -3];
        expect(cosineSimilarity(v1, v2)).toBeCloseTo(-1.0);
    });

    it('should handle zero vectors', () => {
        const v1 = [0, 0, 0];
        const v2 = [1, 2, 3];
        const result = cosineSimilarity(v1, v2);
        expect(isFinite(result)).toBe(true);
    });
});

describe('createEmbeddingProvider', () => {
    it('should create local provider by default', () => {
        const provider = createEmbeddingProvider();
        expect(provider.name).toBe('local');
        expect(provider.dimensions).toBe(256);
    });

    it('should create local provider when specified', () => {
        const provider = createEmbeddingProvider({ embeddingBackend: 'local' });
        expect(provider.name).toBe('local');
    });

    it('should create ollama provider', () => {
        const provider = createEmbeddingProvider({ embeddingBackend: 'ollama' });
        expect(provider.name).toBe('ollama');
        expect(provider.dimensions).toBe(768);
    });

    it('should create openai provider', () => {
        const provider = createEmbeddingProvider({
            embeddingBackend: 'openai',
            openaiKey: 'test-key',
        });
        expect(provider.name).toBe('openai');
        expect(provider.dimensions).toBe(1536);
    });
});
