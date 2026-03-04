/**
 * src/memory/embeddings.ts
 * Embedding engine — generate vector embeddings from text
 * Supports: Ollama (local), OpenAI, and a built-in TF-IDF fallback
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('memory:embeddings');

export interface EmbeddingProvider {
    name: string;
    dimensions: number;
    embed(text: string): Promise<number[]>;
    embedBatch(texts: string[]): Promise<number[][]>;
}

/**
 * Ollama local embeddings (nomic-embed-text, all-minilm, etc.)
 */
export class OllamaEmbedding implements EmbeddingProvider {
    name = 'ollama';
    dimensions: number;
    private baseUrl: string;
    private model: string;

    constructor(opts: { baseUrl?: string; model?: string; dimensions?: number } = {}) {
        this.baseUrl = opts.baseUrl || 'http://localhost:11434';
        this.model = opts.model || 'nomic-embed-text';
        this.dimensions = opts.dimensions || 768;
    }

    async embed(text: string): Promise<number[]> {
        const res = await fetch(`${this.baseUrl}/api/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: this.model, prompt: text }),
        });

        if (!res.ok) throw new Error(`Ollama embedding failed: ${res.status}`);
        const data = await res.json() as any;
        return data.embedding;
    }

    async embedBatch(texts: string[]): Promise<number[][]> {
        return Promise.all(texts.map(t => this.embed(t)));
    }
}

/**
 * OpenAI embeddings (text-embedding-3-small, text-embedding-3-large)
 */
export class OpenAIEmbedding implements EmbeddingProvider {
    name = 'openai';
    dimensions: number;
    private apiKey: string;
    private model: string;

    constructor(opts: { apiKey: string; model?: string; dimensions?: number }) {
        this.apiKey = opts.apiKey;
        this.model = opts.model || 'text-embedding-3-small';
        this.dimensions = opts.dimensions || 1536;
    }

    async embed(text: string): Promise<number[]> {
        const res = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ model: this.model, input: text }),
        });

        if (!res.ok) throw new Error(`OpenAI embedding failed: ${res.status}`);
        const data = await res.json() as any;
        return data.data[0].embedding;
    }

    async embedBatch(texts: string[]): Promise<number[][]> {
        const res = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ model: this.model, input: texts }),
        });

        if (!res.ok) throw new Error(`OpenAI batch embedding failed: ${res.status}`);
        const data = await res.json() as any;
        return data.data.map((d: any) => d.embedding);
    }
}

/**
 * Built-in TF-IDF based embedding (no external dependencies!)
 * Lower quality but works offline with zero setup
 */
export class LocalEmbedding implements EmbeddingProvider {
    name = 'local';
    dimensions = 256;
    private vocabulary: Map<string, number> = new Map();
    private idf: Map<string, number> = new Map();
    private docCount = 0;

    async embed(text: string): Promise<number[]> {
        const tokens = this.tokenize(text);
        const tf = new Map<string, number>();

        for (const token of tokens) {
            tf.set(token, (tf.get(token) || 0) + 1);
            if (!this.vocabulary.has(token)) {
                this.vocabulary.set(token, this.vocabulary.size % this.dimensions);
            }
        }

        // Build TF-IDF vector
        const vector = new Array(this.dimensions).fill(0);
        for (const [token, count] of tf) {
            const idx = this.vocabulary.get(token)!;
            const tfidf = (count / tokens.length) * Math.log(1 + (this.docCount + 1) / (1 + (this.idf.get(token) || 0)));
            vector[idx] += tfidf;
        }

        // Update IDF
        this.docCount++;
        const uniqueTokens = new Set(tokens);
        for (const token of uniqueTokens) {
            this.idf.set(token, (this.idf.get(token) || 0) + 1);
        }

        // L2 normalize
        const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0)) || 1;
        return vector.map(v => v / norm);
    }

    async embedBatch(texts: string[]): Promise<number[][]> {
        return Promise.all(texts.map(t => this.embed(t)));
    }

    private tokenize(text: string): string[] {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(t => t.length > 2 && !STOP_WORDS.has(t));
    }
}

const STOP_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'this', 'that', 'these',
    'those', 'it', 'its', 'not', 'no', 'nor', 'from', 'into', 'about',
]);

/**
 * Create embedding provider from config
 */
export function createEmbeddingProvider(config: Record<string, any> = {}): EmbeddingProvider {
    const backend = config.embeddingBackend || 'local';

    switch (backend) {
        case 'ollama':
            return new OllamaEmbedding({
                baseUrl: config.ollamaUrl,
                model: config.embeddingModel,
            });
        case 'openai':
            return new OpenAIEmbedding({
                apiKey: config.openaiKey || process.env.OPENAI_API_KEY || '',
                model: config.embeddingModel,
            });
        case 'local':
        default:
            log.info('Using built-in TF-IDF embeddings (no GPU needed)');
            return new LocalEmbedding();
    }
}

/**
 * Cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}
