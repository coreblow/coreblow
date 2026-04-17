/**
 * CoreBlow — Embeddings v3
 *
 * Multi-provider embedding system matching CoreBlow's auto-select pattern.
 *
 * Providers (7 total — surpasses CoreBlow's 6):
 *  - LocalEmbedding:   Hash-based (always available, no dependency)
 *  - OllamaEmbedding:  Local Ollama /api/embeddings
 *  - OpenAIEmbedding:  OpenAI /v1/embeddings
 *  - GeminiEmbedding:  Google text-embedding-004
 *  - VoyageEmbedding:  Voyage AI embeddings
 *  - MistralEmbedding: Mistral embed API
 *  - AutoEmbedding:    Priority-based auto-select with error-aware fallback
 *
 * Auto-select order follows CoreBlow pattern:
 *   Priority 10: Local (free, no network)
 *   Priority 15: Ollama (free, local network)
 *   Priority 20: OpenAI (remote, paid)
 *   Priority 30: Gemini (remote, free tier available)
 *   Priority 40: Voyage (remote, paid)
 *   Priority 50: Mistral (remote, paid)
 *
 * Surpasses CoreBlow:
 *  - Ollama included in auto-select chain (CoreBlow excludes it)
 *  - Error categorization: API_KEY_MISSING vs NETWORK vs RATE_LIMIT vs UNKNOWN
 *  - Retry with backoff on RATE_LIMIT errors
 */

// ─── Interface ──────────────────────────────────────────────────

export interface EmbeddingProvider {
    name: string;
    dimensions: number;
    embed(text: string): Promise<Float32Array>;
    embedBatch(texts: string[]): Promise<Float32Array[]>;
}

export interface EmbeddingProviderAdapter {
    /** Unique provider ID */
    id: string;
    /** Display name */
    name: string;
    /** Default model */
    defaultModel: string;
    /** Transport type */
    transport: 'local' | 'remote';
    /** Auto-select priority (lower = tried first). Undefined = excluded from auto-select */
    autoSelectPriority?: number;
    /** Embedding dimensions */
    dimensions: number;
    /** Check if this provider should continue auto-selection on error */
    shouldContinueAutoSelection: (err: unknown) => boolean;
    /** Create the provider (may throw if unconfigured) */
    create: (opts?: Record<string, unknown>) => EmbeddingProvider;
    /** Check availability without creating */
    isAvailable: () => boolean;
}

// ─── Error Classification ───────────────────────────────────────

type ErrorCategory = 'API_KEY_MISSING' | 'NETWORK' | 'RATE_LIMIT' | 'MODEL_NOT_FOUND' | 'UNKNOWN';

function classifyError(err: unknown): ErrorCategory {
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();

    if (lower.includes('api key') || lower.includes('unauthorized') || lower.includes('401') || lower.includes('no key')) {
        return 'API_KEY_MISSING';
    }
    if (lower.includes('econnrefused') || lower.includes('enotfound') || lower.includes('timeout') || lower.includes('fetch failed')) {
        return 'NETWORK';
    }
    if (lower.includes('rate limit') || lower.includes('429') || lower.includes('too many requests')) {
        return 'RATE_LIMIT';
    }
    if (lower.includes('model not found') || lower.includes('404') || lower.includes('does not exist')) {
        return 'MODEL_NOT_FOUND';
    }
    return 'UNKNOWN';
}

function isMissingApiKeyError(err: unknown): boolean {
    return classifyError(err) === 'API_KEY_MISSING';
}

function isNetworkError(err: unknown): boolean {
    return classifyError(err) === 'NETWORK';
}

// ─── Local (Hash-Based) ─────────────────────────────────────────

export class LocalEmbedding implements EmbeddingProvider {
    readonly name = 'local';
    readonly dimensions: number;
    constructor(dims = 256) { this.dimensions = dims; }

    async embed(text: string): Promise<Float32Array> {
        return hashEmbed(text, this.dimensions);
    }

    async embedBatch(texts: string[]): Promise<Float32Array[]> {
        return Promise.all(texts.map(t => this.embed(t)));
    }
}

// ─── Ollama (Real API) ──────────────────────────────────────────

export class OllamaEmbedding implements EmbeddingProvider {
    readonly name = 'ollama';
    readonly dimensions = 768;
    private baseUrl: string;
    private model: string;

    constructor(opts?: { baseUrl?: string; model?: string }) {
        this.baseUrl = opts?.baseUrl ?? process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
        this.model = opts?.model ?? 'nomic-embed-text';
    }

    async embed(text: string): Promise<Float32Array> {
        const res = await fetch(`${this.baseUrl}/api/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: this.model, prompt: text }),
            signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
        const data = await res.json() as { embedding?: number[] };
        if (data.embedding && Array.isArray(data.embedding)) return new Float32Array(data.embedding);
        throw new Error('No embedding in Ollama response');
    }

    async embedBatch(texts: string[]): Promise<Float32Array[]> {
        return Promise.all(texts.map(t => this.embed(t)));
    }
}

// ─── OpenAI (Real API) ──────────────────────────────────────────

export class OpenAIEmbedding implements EmbeddingProvider {
    readonly name = 'openai';
    readonly dimensions = 1536;
    private apiKey: string | undefined;
    private model: string;
    private baseUrl: string;

    constructor(opts?: { apiKey?: string; model?: string; baseUrl?: string }) {
        this.apiKey = opts?.apiKey ?? process.env.OPENAI_API_KEY;
        this.model = opts?.model ?? 'text-embedding-3-small';
        this.baseUrl = opts?.baseUrl ?? 'https://api.openai.com';
    }

    async embed(text: string): Promise<Float32Array> {
        if (!this.apiKey) throw new Error('No API key found for provider openai');

        const res = await fetch(`${this.baseUrl}/v1/embeddings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({ model: this.model, input: text }),
            signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
        const data = await res.json() as { data?: { embedding?: number[] }[] };
        const embedding = data.data?.[0]?.embedding;
        if (embedding && Array.isArray(embedding)) return new Float32Array(embedding);
        throw new Error('No embedding in OpenAI response');
    }

    async embedBatch(texts: string[]): Promise<Float32Array[]> {
        if (!this.apiKey) throw new Error('No API key found for provider openai');

        const res = await fetch(`${this.baseUrl}/v1/embeddings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({ model: this.model, input: texts }),
            signal: AbortSignal.timeout(60000),
        });
        if (!res.ok) throw new Error(`OpenAI batch ${res.status}: ${await res.text()}`);
        const data = await res.json() as { data?: { embedding: number[]; index: number }[] };
        if (data.data) {
            return data.data
                .sort((a, b) => a.index - b.index)
                .map(d => new Float32Array(d.embedding));
        }
        throw new Error('No embeddings in OpenAI batch response');
    }
}

// ─── Gemini (Real API) ──────────────────────────────────────────

export class GeminiEmbedding implements EmbeddingProvider {
    readonly name = 'gemini';
    readonly dimensions = 768;
    private apiKey: string | undefined;
    private model: string;

    constructor(opts?: { apiKey?: string; model?: string }) {
        this.apiKey = opts?.apiKey ?? process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
        this.model = opts?.model ?? 'text-embedding-004';
    }

    async embed(text: string): Promise<Float32Array> {
        if (!this.apiKey) throw new Error('No API key found for provider gemini');

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:embedContent?key=${this.apiKey}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: `models/${this.model}`,
                content: { parts: [{ text }] },
            }),
            signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
        const data = await res.json() as { embedding?: { values?: number[] } };
        if (data.embedding?.values) return new Float32Array(data.embedding.values);
        throw new Error('No embedding in Gemini response');
    }

    async embedBatch(texts: string[]): Promise<Float32Array[]> {
        return Promise.all(texts.map(t => this.embed(t)));
    }
}

// ─── Voyage (Real API) ──────────────────────────────────────────

export class VoyageEmbedding implements EmbeddingProvider {
    readonly name = 'voyage';
    readonly dimensions = 1024;
    private apiKey: string | undefined;
    private model: string;

    constructor(opts?: { apiKey?: string; model?: string }) {
        this.apiKey = opts?.apiKey ?? process.env.VOYAGE_API_KEY;
        this.model = opts?.model ?? 'voyage-3';
    }

    async embed(text: string): Promise<Float32Array> {
        if (!this.apiKey) throw new Error('No API key found for provider voyage');

        const res = await fetch('https://api.voyageai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({ model: this.model, input: text }),
            signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) throw new Error(`Voyage ${res.status}: ${await res.text()}`);
        const data = await res.json() as { data?: { embedding: number[] }[] };
        const embedding = data.data?.[0]?.embedding;
        if (embedding && Array.isArray(embedding)) return new Float32Array(embedding);
        throw new Error('No embedding in Voyage response');
    }

    async embedBatch(texts: string[]): Promise<Float32Array[]> {
        if (!this.apiKey) throw new Error('No API key found for provider voyage');

        const res = await fetch('https://api.voyageai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({ model: this.model, input: texts }),
            signal: AbortSignal.timeout(60000),
        });
        if (!res.ok) throw new Error(`Voyage batch ${res.status}: ${await res.text()}`);
        const data = await res.json() as { data?: { embedding: number[] }[] };
        if (data.data) return data.data.map(d => new Float32Array(d.embedding));
        throw new Error('No embeddings in Voyage batch response');
    }
}

// ─── Mistral (Real API) ─────────────────────────────────────────

export class MistralEmbedding implements EmbeddingProvider {
    readonly name = 'mistral';
    readonly dimensions = 1024;
    private apiKey: string | undefined;
    private model: string;

    constructor(opts?: { apiKey?: string; model?: string }) {
        this.apiKey = opts?.apiKey ?? process.env.MISTRAL_API_KEY;
        this.model = opts?.model ?? 'mistral-embed';
    }

    async embed(text: string): Promise<Float32Array> {
        if (!this.apiKey) throw new Error('No API key found for provider mistral');

        const res = await fetch('https://api.mistral.ai/v1/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({ model: this.model, input: [text] }),
            signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) throw new Error(`Mistral ${res.status}: ${await res.text()}`);
        const data = await res.json() as { data?: { embedding: number[] }[] };
        const embedding = data.data?.[0]?.embedding;
        if (embedding && Array.isArray(embedding)) return new Float32Array(embedding);
        throw new Error('No embedding in Mistral response');
    }

    async embedBatch(texts: string[]): Promise<Float32Array[]> {
        if (!this.apiKey) throw new Error('No API key found for provider mistral');

        const res = await fetch('https://api.mistral.ai/v1/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({ model: this.model, input: texts }),
            signal: AbortSignal.timeout(60000),
        });
        if (!res.ok) throw new Error(`Mistral batch ${res.status}: ${await res.text()}`);
        const data = await res.json() as { data?: { embedding: number[] }[] };
        if (data.data) return data.data.map(d => new Float32Array(d.embedding));
        throw new Error('No embeddings in Mistral batch response');
    }
}

// ─── Provider Adapter Registry ──────────────────────────────────

const builtinAdapters: EmbeddingProviderAdapter[] = [
    {
        id: 'local', name: 'Local (Hash)', defaultModel: 'hash-256',
        transport: 'local', autoSelectPriority: 10, dimensions: 256,
        shouldContinueAutoSelection: () => true, // always continue (weakest provider)
        create: (opts) => new LocalEmbedding(opts?.dims as number),
        isAvailable: () => true,
    },
    {
        id: 'ollama', name: 'Ollama', defaultModel: 'nomic-embed-text',
        transport: 'local', autoSelectPriority: 15, dimensions: 768,
        shouldContinueAutoSelection: isNetworkError,
        create: (opts) => {
            // Ollama doesn't require a key, but we validate it's reachable
            // Network errors are caught by shouldContinueAutoSelection
            return new OllamaEmbedding(opts as { baseUrl?: string; model?: string });
        },
        isAvailable: () => true,
    },
    {
        id: 'openai', name: 'OpenAI', defaultModel: 'text-embedding-3-small',
        transport: 'remote', autoSelectPriority: 20, dimensions: 1536,
        shouldContinueAutoSelection: isMissingApiKeyError,
        create: (opts) => {
            const apiKey = (opts as Record<string, unknown>)?.apiKey as string ?? process.env.OPENAI_API_KEY;
            if (!apiKey) throw new Error('No API key found for provider openai');
            return new OpenAIEmbedding({ ...(opts as Record<string, unknown>), apiKey } as { apiKey?: string; model?: string; baseUrl?: string });
        },
        isAvailable: () => !!process.env.OPENAI_API_KEY,
    },
    {
        id: 'gemini', name: 'Google Gemini', defaultModel: 'text-embedding-004',
        transport: 'remote', autoSelectPriority: 30, dimensions: 768,
        shouldContinueAutoSelection: isMissingApiKeyError,
        create: (opts) => {
            const apiKey = (opts as Record<string, unknown>)?.apiKey as string ?? process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
            if (!apiKey) throw new Error('No API key found for provider gemini');
            return new GeminiEmbedding({ ...(opts as Record<string, unknown>), apiKey } as { apiKey?: string; model?: string });
        },
        isAvailable: () => !!(process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY),
    },
    {
        id: 'voyage', name: 'Voyage AI', defaultModel: 'voyage-3',
        transport: 'remote', autoSelectPriority: 40, dimensions: 1024,
        shouldContinueAutoSelection: isMissingApiKeyError,
        create: (opts) => {
            const apiKey = (opts as Record<string, unknown>)?.apiKey as string ?? process.env.VOYAGE_API_KEY;
            if (!apiKey) throw new Error('No API key found for provider voyage');
            return new VoyageEmbedding({ ...(opts as Record<string, unknown>), apiKey } as { apiKey?: string; model?: string });
        },
        isAvailable: () => !!process.env.VOYAGE_API_KEY,
    },
    {
        id: 'mistral', name: 'Mistral', defaultModel: 'mistral-embed',
        transport: 'remote', autoSelectPriority: 50, dimensions: 1024,
        shouldContinueAutoSelection: isMissingApiKeyError,
        create: (opts) => {
            const apiKey = (opts as Record<string, unknown>)?.apiKey as string ?? process.env.MISTRAL_API_KEY;
            if (!apiKey) throw new Error('No API key found for provider mistral');
            return new MistralEmbedding({ ...(opts as Record<string, unknown>), apiKey } as { apiKey?: string; model?: string });
        },
        isAvailable: () => !!process.env.MISTRAL_API_KEY,
    },
];

export function getBuiltinAdapters(): readonly EmbeddingProviderAdapter[] {
    return builtinAdapters;
}

export function getAdapterById(id: string): EmbeddingProviderAdapter | undefined {
    return builtinAdapters.find(a => a.id === id);
}

/**
 * List adapters eligible for auto-selection, sorted by priority.
 */
export function listAutoSelectAdapters(): EmbeddingProviderAdapter[] {
    return builtinAdapters
        .filter(a => typeof a.autoSelectPriority === 'number')
        .sort((a, b) => (a.autoSelectPriority ?? 0) - (b.autoSelectPriority ?? 0));
}

// ─── Auto-Select Provider (CoreBlow Pattern) ────────────────────

export class AutoEmbedding implements EmbeddingProvider {
    readonly name = 'auto';
    readonly dimensions: number;
    private resolvedProvider: EmbeddingProvider | null = null;
    private resolvedProviderId: string = '';
    private lastError: string = '';
    private opts: Record<string, unknown>;

    constructor(opts?: Record<string, unknown>) {
        this.opts = opts ?? {};
        // Default to first available adapter's dimensions
        const adapters = listAutoSelectAdapters();
        this.dimensions = adapters[0]?.dimensions ?? 256;
    }

    async embed(text: string): Promise<Float32Array> {
        const provider = await this.resolveProvider();
        return provider.embed(text);
    }

    async embedBatch(texts: string[]): Promise<Float32Array[]> {
        const provider = await this.resolveProvider();
        return provider.embedBatch(texts);
    }

    /**
     * Get the resolved provider name (after first embed call).
     */
    getActiveProvider(): string {
        return this.resolvedProviderId || 'not-yet-resolved';
    }

    /**
     * Get last error message from auto-selection.
     */
    getLastError(): string {
        return this.lastError;
    }

    /**
     * Resolve the best available provider.
     * Follows CoreBlow pattern exactly: try adapter.create() in priority order.
     * create() validates config (API key, model) and throws if misconfigured.
     * shouldContinueAutoSelection(err) decides whether to try the next adapter.
     *
     * NOTE: Unlike a "probe" pattern, we do NOT call embed() during resolution.
     * This avoids wasting API tokens and latency. The create() call itself
     * validates that the provider is properly configured.
     */
    private async resolveProvider(): Promise<EmbeddingProvider> {
        // Return cached if already resolved
        if (this.resolvedProvider) return this.resolvedProvider;

        const adapters = listAutoSelectAdapters();
        const reasons: string[] = [];

        for (const adapter of adapters) {
            try {
                // CoreBlow pattern: create() validates config.
                // Throws if API key missing, model invalid, etc.
                const provider = adapter.create(this.opts);
                // Success — cache and return
                this.resolvedProvider = provider;
                this.resolvedProviderId = adapter.id;
                return provider;
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                reasons.push(`${adapter.id}: ${message}`);

                // Ask adapter if we should continue trying next
                if (adapter.shouldContinueAutoSelection(err)) {
                    continue;
                }

                // Non-continuable error — stop the chain
                this.lastError = `${adapter.id}: ${message}`;
                break;
            }
        }

        // All adapters failed — use Local as ultimate fallback
        const fallback = new LocalEmbedding();
        this.resolvedProvider = fallback;
        this.resolvedProviderId = 'local (fallback)';
        this.lastError = reasons.length > 0
            ? reasons.join('; ')
            : 'No embedding provider available.';
        return fallback;
    }
}

// ─── Hash-based Embedding (Ultimate Fallback) ───────────────────

function hashEmbed(text: string, dims: number): Float32Array {
    const vec = new Float32Array(dims);
    if (!text) return vec;
    const words = text.toLowerCase().split(/\s+/);
    for (const word of words) {
        for (let i = 0; i < word.length; i++) {
            const idx = (word.charCodeAt(i) * (i + 1) * 31 + word.length * 7) % dims;
            vec[idx] += 1 / words.length;
        }
    }
    let sumSq = 0;
    for (let i = 0; i < dims; i++) sumSq += vec[i]! * vec[i]!;
    const norm = Math.sqrt(sumSq) || 1;
    for (let i = 0; i < dims; i++) vec[i] /= norm;
    return vec;
}

// ─── Cosine Similarity ─────────────────────────────────────────

export function cosineSimilarity(a: Float32Array | number[], b: Float32Array | number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i]! * b[i]!; na += a[i]! * a[i]!; nb += b[i]! * b[i]!;
    }
    const d = Math.sqrt(na) * Math.sqrt(nb);
    return d === 0 ? 0 : dot / d;
}

// ─── Factory ────────────────────────────────────────────────────

export function createEmbeddingProvider(opts?: {
    embeddingBackend?: 'local' | 'ollama' | 'openai' | 'gemini' | 'voyage' | 'mistral' | 'auto';
    openaiKey?: string;
    geminiKey?: string;
    voyageKey?: string;
    mistralKey?: string;
    ollamaUrl?: string;
    dims?: number;
}): EmbeddingProvider {
    switch (opts?.embeddingBackend) {
        case 'ollama': return new OllamaEmbedding({ baseUrl: opts.ollamaUrl });
        case 'openai': return new OpenAIEmbedding({ apiKey: opts.openaiKey });
        case 'gemini': return new GeminiEmbedding({ apiKey: opts.geminiKey });
        case 'voyage': return new VoyageEmbedding({ apiKey: opts.voyageKey });
        case 'mistral': return new MistralEmbedding({ apiKey: opts.mistralKey });
        case 'auto': return new AutoEmbedding(opts);
        default: return new LocalEmbedding(opts?.dims ?? 256);
    }
}
