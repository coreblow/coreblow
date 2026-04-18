/**
 * plugins/web-search-providers.shared.test.ts — Web search provider tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { registerSearchProvider, getSearchProvider, listSearchProviders, resetSearchProviders } from './web-search-providers.shared.js';

describe('Web Search Providers', () => {
    beforeEach(() => resetSearchProviders());

    it('should register and get provider', () => {
        registerSearchProvider({
            id: 'test',
            name: 'Test Search',
            search: async () => [],
        });
        expect(getSearchProvider('test')).toBeDefined();
        expect(getSearchProvider('test')?.name).toBe('Test Search');
    });

    it('should list providers', () => {
        registerSearchProvider({ id: 'a', name: 'A', search: async () => [] });
        registerSearchProvider({ id: 'b', name: 'B', search: async () => [] });
        expect(listSearchProviders()).toHaveLength(2);
    });

    it('should return undefined for unknown', () => {
        expect(getSearchProvider('nope')).toBeUndefined();
    });

    it('should reset providers', () => {
        registerSearchProvider({ id: 'a', name: 'A', search: async () => [] });
        resetSearchProviders();
        expect(listSearchProviders()).toHaveLength(0);
    });
});
