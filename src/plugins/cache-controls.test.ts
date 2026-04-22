/**
 * CoreBlow — Plugin Cache Controls Tests
 *
 * Tests for cache toggle, TTL resolution, snapshot cache
 * decisions, and env key building.
 */

import { describe, it, expect } from 'vitest';
import {
    DEFAULT_PLUGIN_DISCOVERY_CACHE_MS,
    DEFAULT_PLUGIN_MANIFEST_CACHE_MS,
    shouldUsePluginSnapshotCache,
    resolvePluginCacheMs,
    resolvePluginSnapshotCacheTtlMs,
    buildPluginSnapshotCacheEnvKey,
} from './cache-controls.js';

describe('shouldUsePluginSnapshotCache', () => {
    it('returns true with empty env', () => {
        expect(shouldUsePluginSnapshotCache({} as NodeJS.ProcessEnv)).toBe(true);
    });

    it('returns false when discovery cache disabled', () => {
        expect(shouldUsePluginSnapshotCache({
            COREBLOW_DISABLE_PLUGIN_DISCOVERY_CACHE: 'true',
        } as NodeJS.ProcessEnv)).toBe(false);
    });

    it('returns false when manifest cache disabled', () => {
        expect(shouldUsePluginSnapshotCache({
            COREBLOW_DISABLE_PLUGIN_MANIFEST_CACHE: '1',
        } as NodeJS.ProcessEnv)).toBe(false);
    });

    it('returns false when discovery cache ms is 0', () => {
        expect(shouldUsePluginSnapshotCache({
            COREBLOW_PLUGIN_DISCOVERY_CACHE_MS: '0',
        } as NodeJS.ProcessEnv)).toBe(false);
    });

    it('returns false when manifest cache ms is 0', () => {
        expect(shouldUsePluginSnapshotCache({
            COREBLOW_PLUGIN_MANIFEST_CACHE_MS: '0',
        } as NodeJS.ProcessEnv)).toBe(false);
    });
});

describe('resolvePluginCacheMs', () => {
    it('returns default when undefined', () => {
        expect(resolvePluginCacheMs(undefined, 1000)).toBe(1000);
    });

    it('returns 0 for "0"', () => {
        expect(resolvePluginCacheMs('0', 1000)).toBe(0);
    });

    it('returns 0 for empty string', () => {
        expect(resolvePluginCacheMs('', 1000)).toBe(0);
    });

    it('parses valid integer', () => {
        expect(resolvePluginCacheMs('5000', 1000)).toBe(5000);
    });

    it('returns default for non-numeric', () => {
        expect(resolvePluginCacheMs('abc', 1000)).toBe(1000);
    });

    it('clamps negative to 0', () => {
        expect(resolvePluginCacheMs('-100', 1000)).toBe(0);
    });
});

describe('resolvePluginSnapshotCacheTtlMs', () => {
    it('returns min of discovery and manifest cache', () => {
        expect(resolvePluginSnapshotCacheTtlMs({
            COREBLOW_PLUGIN_DISCOVERY_CACHE_MS: '500',
            COREBLOW_PLUGIN_MANIFEST_CACHE_MS: '2000',
        } as NodeJS.ProcessEnv)).toBe(500);
    });

    it('uses defaults when not set', () => {
        const result = resolvePluginSnapshotCacheTtlMs({} as NodeJS.ProcessEnv);
        expect(result).toBe(Math.min(DEFAULT_PLUGIN_DISCOVERY_CACHE_MS, DEFAULT_PLUGIN_MANIFEST_CACHE_MS));
    });
});

describe('buildPluginSnapshotCacheEnvKey', () => {
    it('extracts relevant env vars', () => {
        const key = buildPluginSnapshotCacheEnvKey({
            COREBLOW_HOME: '/home/cb',
            HOME: '/home/user',
            UNRELATED: 'ignored',
        } as NodeJS.ProcessEnv);
        expect(key.COREBLOW_HOME).toBe('/home/cb');
        expect(key.HOME).toBe('/home/user');
        expect((key as any).UNRELATED).toBeUndefined();
    });

    it('defaults missing vars to empty string', () => {
        const key = buildPluginSnapshotCacheEnvKey({} as NodeJS.ProcessEnv);
        expect(key.COREBLOW_HOME).toBe('');
        expect(key.HOME).toBe('');
    });
});
