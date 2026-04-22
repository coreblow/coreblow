import { describe, it, expect } from 'vitest';
import { dedupeProfileIds, listProfilesForProvider } from './auth-profiles/profiles.js';
import type { AuthProfileStore } from './auth-profiles/types.js';

function makeStore(profiles: AuthProfileStore['profiles']): AuthProfileStore {
    return { version: 1, profiles };
}

describe('dedupeProfileIds', () => {
    it('removes duplicate profile IDs', () => {
        expect(dedupeProfileIds(['a', 'b', 'a', 'c', 'b'])).toEqual(['a', 'b', 'c']);
    });

    it('preserves order of first occurrence', () => {
        expect(dedupeProfileIds(['c', 'a', 'b', 'a'])).toEqual(['c', 'a', 'b']);
    });

    it('returns empty for empty input', () => {
        expect(dedupeProfileIds([])).toEqual([]);
    });

    it('returns same array if no duplicates', () => {
        expect(dedupeProfileIds(['x', 'y', 'z'])).toEqual(['x', 'y', 'z']);
    });
});

describe('listProfilesForProvider', () => {
    it('returns profiles matching provider', () => {
        const store = makeStore({
            'openai-key-1': { type: 'api_key', provider: 'openai', key: 'sk-1' },
            'openai-key-2': { type: 'api_key', provider: 'openai', key: 'sk-2' },
            'anthro-key': { type: 'api_key', provider: 'anthropic', key: 'sk-a' },
        });

        const result = listProfilesForProvider(store, 'openai');
        expect(result).toEqual(expect.arrayContaining(['openai-key-1', 'openai-key-2']));
        expect(result).toHaveLength(2);
    });

    it('normalizes provider for matching', () => {
        const store = makeStore({
            'zai-key': { type: 'api_key', provider: 'z.ai', key: 'k' },
        });

        // z-ai should match z.ai through normalization
        expect(listProfilesForProvider(store, 'z-ai')).toEqual(['zai-key']);
    });

    it('returns empty for non-existent provider', () => {
        const store = makeStore({
            'openai-key': { type: 'api_key', provider: 'openai', key: 'k' },
        });
        expect(listProfilesForProvider(store, 'google')).toEqual([]);
    });

    it('returns empty for empty store', () => {
        expect(listProfilesForProvider(makeStore({}), 'openai')).toEqual([]);
    });
});
