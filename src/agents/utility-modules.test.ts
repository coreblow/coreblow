/**
 * Tests for CoreBlow API Key Rotation, Current Time, Announce Idempotency, Cache Trace
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ─── API Key Rotation Tests ──────────────────────────────────────

import {
    registerKeys,
    getNextKey,
    reportKeyError,
    reportKeySuccess,
    getPoolStats,
    clearPool,
    clearAllPools,
    hasHealthyKeys,
} from './api-key-rotation.js';

describe('API Key Rotation', () => {
    beforeEach(() => clearAllPools());

    it('should register and retrieve keys', () => {
        registerKeys('openai', [{ key: 'sk-1' }, { key: 'sk-2' }]);
        const key = getNextKey('openai');
        expect(['sk-1', 'sk-2']).toContain(key);
    });

    it('should return null for unregistered provider', () => {
        expect(getNextKey('unknown')).toBeNull();
    });

    it('should rotate between keys', () => {
        registerKeys('openai', [
            { key: 'sk-1', weight: 1 },
            { key: 'sk-2', weight: 1 },
        ]);
        const key1 = getNextKey('openai');
        const key2 = getNextKey('openai');
        // Should have used both (or at least rotated)
        expect(key1).toBeDefined();
        expect(key2).toBeDefined();
    });

    it('should prefer higher weight keys', () => {
        registerKeys('openai', [
            { key: 'sk-low', weight: 1 },
            { key: 'sk-high', weight: 10 },
        ]);
        const key = getNextKey('openai');
        expect(key).toBe('sk-high');
    });

    it('should mark unhealthy after errors', () => {
        registerKeys('openai', [{ key: 'sk-1' }]);
        reportKeyError('openai', 'sk-1');
        reportKeyError('openai', 'sk-1');
        reportKeyError('openai', 'sk-1');
        const stats = getPoolStats('openai');
        expect(stats!.healthyKeys).toBe(0);
    });

    it('should recover on success', () => {
        registerKeys('openai', [{ key: 'sk-1' }]);
        reportKeyError('openai', 'sk-1');
        reportKeyError('openai', 'sk-1');
        reportKeyError('openai', 'sk-1');
        reportKeySuccess('openai', 'sk-1');
        expect(hasHealthyKeys('openai')).toBe(true);
    });

    it('should apply rate limit backoff', () => {
        registerKeys('openai', [{ key: 'sk-1' }, { key: 'sk-2' }]);
        reportKeyError('openai', 'sk-1', true); // rate limit
        const key = getNextKey('openai');
        expect(key).toBe('sk-2'); // should skip sk-1
    });

    it('should report pool stats', () => {
        registerKeys('openai', [{ key: 'sk-1' }, { key: 'sk-2' }]);
        getNextKey('openai');
        const stats = getPoolStats('openai');
        expect(stats).not.toBeNull();
        expect(stats!.totalKeys).toBe(2);
        expect(stats!.rotations).toBe(1);
    });

    it('should clear pool', () => {
        registerKeys('openai', [{ key: 'sk-1' }]);
        clearPool('openai');
        expect(getNextKey('openai')).toBeNull();
    });
});

// ─── Current Time Tests ──────────────────────────────────────────

import {
    getCurrentTime,
    formatTimeForPrompt,
    validateTimezone,
} from './current-time.js';

describe('Current Time', () => {
    it('should get current time', () => {
        const time = getCurrentTime();
        expect(time.iso).toContain('T');
        expect(time.timestamp).toBeGreaterThan(0);
        expect(time.dayOfWeek.length).toBeGreaterThan(0);
        expect(time.timezone.length).toBeGreaterThan(0);
    });

    it('should respect timezone', () => {
        const time = getCurrentTime('Asia/Jakarta');
        expect(time.timezone).toBe('Asia/Jakarta');
    });

    it('should format for prompt', () => {
        const result = formatTimeForPrompt('UTC');
        expect(result).toContain('UTC');
    });

    it('should validate valid timezones', () => {
        expect(validateTimezone('UTC')).toBe('UTC');
        expect(validateTimezone('Asia/Jakarta')).toBe('Asia/Jakarta');
        expect(validateTimezone('America/New_York')).toBe('America/New_York');
    });

    it('should reject invalid timezones', () => {
        expect(validateTimezone('Invalid/Zone')).toBeUndefined();
    });
});

// ─── Announce Idempotency Tests ──────────────────────────────────

import {
    isDuplicateAnnounce,
    buildAnnounceKey,
    clearAnnounceCache,
} from './announce-idempotency.js';

describe('Announce Idempotency', () => {
    beforeEach(() => clearAnnounceCache());

    it('should detect first occurrence as not duplicate', () => {
        expect(isDuplicateAnnounce('key-1')).toBe(false);
    });

    it('should detect second occurrence as duplicate', () => {
        isDuplicateAnnounce('key-1');
        expect(isDuplicateAnnounce('key-1')).toBe(true);
    });

    it('should allow different keys', () => {
        isDuplicateAnnounce('key-1');
        expect(isDuplicateAnnounce('key-2')).toBe(false);
    });

    it('should expire entries after TTL', () => {
        isDuplicateAnnounce('key-1', 1); // 1ms TTL
        // Wait a bit
        const start = Date.now();
        while (Date.now() - start < 10) { /* busy wait */ }
        expect(isDuplicateAnnounce('key-1', 1)).toBe(false);
    });

    it('should build announce keys', () => {
        const key = buildAnnounceKey('session-1', 'sub-1', 'msg-1');
        expect(key).toBe('session-1:sub-1:msg-1');
    });
});

// ─── Cache Trace Tests ───────────────────────────────────────────

import {
    recordCacheHit,
    recordCacheMiss,
    getCacheTraceStats,
    getRecentTraces,
    clearCacheTraces,
    formatCacheTraceStats,
} from './cache-trace.js';

describe('Cache Trace', () => {
    beforeEach(() => clearCacheTraces());

    it('should record cache hits', () => {
        recordCacheHit({ sessionId: 's1', provider: 'openai', model: 'gpt-4o', tokensSaved: 1000 });
        const stats = getCacheTraceStats();
        expect(stats.hits).toBe(1);
        expect(stats.totalTokensSaved).toBe(1000);
    });

    it('should record cache misses', () => {
        recordCacheMiss({ sessionId: 's1', provider: 'openai', model: 'gpt-4o' });
        const stats = getCacheTraceStats();
        expect(stats.misses).toBe(1);
    });

    it('should calculate hit rate', () => {
        recordCacheHit({ sessionId: 's1', provider: 'openai', model: 'gpt-4o', tokensSaved: 500 });
        recordCacheMiss({ sessionId: 's1', provider: 'openai', model: 'gpt-4o' });
        const stats = getCacheTraceStats();
        expect(stats.hitRate).toBe(0.5);
    });

    it('should filter by session', () => {
        recordCacheHit({ sessionId: 's1', provider: 'openai', model: 'gpt-4o', tokensSaved: 100 });
        recordCacheHit({ sessionId: 's2', provider: 'openai', model: 'gpt-4o', tokensSaved: 200 });
        const stats = getCacheTraceStats('s1');
        expect(stats.hits).toBe(1);
        expect(stats.totalTokensSaved).toBe(100);
    });

    it('should get recent traces', () => {
        recordCacheHit({ sessionId: 's1', provider: 'openai', model: 'gpt-4o', tokensSaved: 100 });
        recordCacheMiss({ sessionId: 's1', provider: 'openai', model: 'gpt-4o' });
        const recent = getRecentTraces('s1');
        expect(recent).toHaveLength(2);
    });

    it('should track per-provider stats', () => {
        recordCacheHit({ sessionId: 's1', provider: 'openai', model: 'gpt-4o', tokensSaved: 100 });
        recordCacheHit({ sessionId: 's1', provider: 'anthropic', model: 'claude', tokensSaved: 200 });
        const stats = getCacheTraceStats();
        expect(stats.byProvider['openai']?.tokensSaved).toBe(100);
        expect(stats.byProvider['anthropic']?.tokensSaved).toBe(200);
    });

    it('should format stats for display', () => {
        recordCacheHit({ sessionId: 's1', provider: 'openai', model: 'gpt-4o', tokensSaved: 5000 });
        const stats = getCacheTraceStats();
        const formatted = formatCacheTraceStats(stats);
        expect(formatted).toContain('Cache Trace Stats');
        expect(formatted).toContain('100.0%');
    });
});
