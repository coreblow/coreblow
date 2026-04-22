import { describe, it, expect } from 'vitest';

// ── Inline replicas ────────────────────────────────────────────────

function dedupeApiKeys(raw: string[]): string[] {
    const seen = new Set<string>();
    const keys: string[] = [];
    for (const value of raw) {
        const apiKey = value.trim();
        if (!apiKey || seen.has(apiKey)) continue;
        seen.add(apiKey);
        keys.push(apiKey);
    }
    return keys;
}

async function executeWithApiKeyRotation<T>(params: {
    provider: string;
    apiKeys: string[];
    execute: (apiKey: string) => Promise<T>;
    shouldRetry?: (p: { apiKey: string; error: unknown; attempt: number; message: string }) => boolean;
    onRetry?: (p: { apiKey: string; error: unknown; attempt: number; message: string }) => void;
}): Promise<T> {
    const keys = dedupeApiKeys(params.apiKeys);
    if (keys.length === 0) throw new Error(`No API keys configured for provider "${params.provider}".`);
    let lastError: unknown;
    for (let attempt = 0; attempt < keys.length; attempt++) {
        try { return await params.execute(keys[attempt]!); }
        catch (error) {
            lastError = error;
            const message = error instanceof Error ? error.message : String(error);
            const retryable = params.shouldRetry?.({ apiKey: keys[attempt]!, error, attempt, message }) ?? false;
            if (!retryable || attempt + 1 >= keys.length) break;
            params.onRetry?.({ apiKey: keys[attempt]!, error, attempt, message });
        }
    }
    if (lastError === undefined) throw new Error(`Failed to run API request for ${params.provider}.`);
    throw lastError;
}

// ── Tests ──────────────────────────────────────────────────────────

describe('dedupeApiKeys', () => {
    it('deduplicates identical keys', () => {
        expect(dedupeApiKeys(['a', 'b', 'a'])).toEqual(['a', 'b']);
    });

    it('trims whitespace', () => {
        expect(dedupeApiKeys(['  key1  ', 'key1'])).toEqual(['key1']);
    });

    it('skips empty strings', () => {
        expect(dedupeApiKeys(['', '  ', 'key1'])).toEqual(['key1']);
    });

    it('preserves order', () => {
        expect(dedupeApiKeys(['c', 'a', 'b'])).toEqual(['c', 'a', 'b']);
    });

    it('returns empty for all-empty input', () => {
        expect(dedupeApiKeys(['', ''])).toEqual([]);
    });
});

describe('executeWithApiKeyRotation', () => {
    it('succeeds with first key', async () => {
        const result = await executeWithApiKeyRotation({
            provider: 'test',
            apiKeys: ['key1'],
            execute: async (k) => `ok-${k}`,
        });
        expect(result).toBe('ok-key1');
    });

    it('throws for empty keys', async () => {
        await expect(executeWithApiKeyRotation({
            provider: 'test',
            apiKeys: [],
            execute: async () => 'ok',
        })).rejects.toThrow('No API keys configured');
    });

    it('rotates to next key on retryable error', async () => {
        let attempt = 0;
        const result = await executeWithApiKeyRotation({
            provider: 'test',
            apiKeys: ['bad', 'good'],
            execute: async (k) => {
                attempt++;
                if (k === 'bad') throw new Error('rate limited');
                return `ok-${k}`;
            },
            shouldRetry: () => true,
        });
        expect(result).toBe('ok-good');
        expect(attempt).toBe(2);
    });

    it('throws last error when all keys fail', async () => {
        await expect(executeWithApiKeyRotation({
            provider: 'test',
            apiKeys: ['bad1', 'bad2'],
            execute: async () => { throw new Error('fail'); },
            shouldRetry: () => true,
        })).rejects.toThrow('fail');
    });

    it('calls onRetry callback', async () => {
        const retries: string[] = [];
        await executeWithApiKeyRotation({
            provider: 'test',
            apiKeys: ['k1', 'k2'],
            execute: async (k) => {
                if (k === 'k1') throw new Error('err');
                return 'ok';
            },
            shouldRetry: () => true,
            onRetry: (p) => retries.push(p.apiKey),
        });
        expect(retries).toEqual(['k1']);
    });

    it('stops rotating when shouldRetry returns false', async () => {
        let attempts = 0;
        await expect(executeWithApiKeyRotation({
            provider: 'test',
            apiKeys: ['k1', 'k2', 'k3'],
            execute: async () => { attempts++; throw new Error('err'); },
            shouldRetry: () => false,
        })).rejects.toThrow('err');
        expect(attempts).toBe(1);
    });
});
