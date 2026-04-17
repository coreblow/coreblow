/**
 * CoreBlow Cache Trace
 *
 * Tracing layer for context cache operations. Tracks cache hits/misses,
 * token savings, and provides diagnostic information for prompt caching.
 *
 * Equivalent: CoreBlow src/agents/cache-trace.ts (260 LOC)
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('cache-trace');

// ─── Types ────────────────────────────────────────────────────────

export interface CacheTraceEntry {
    id: string;
    sessionId: string;
    provider: string;
    model: string;
    operation: 'read' | 'write' | 'hit' | 'miss' | 'evict';
    tokensSaved: number;
    cacheKey?: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

export interface CacheTraceStats {
    totalOperations: number;
    hits: number;
    misses: number;
    hitRate: number;
    totalTokensSaved: number;
    evictions: number;
    byProvider: Record<string, { hits: number; misses: number; tokensSaved: number }>;
}

// ─── Trace Store ──────────────────────────────────────────────────

const traces: CacheTraceEntry[] = [];
const MAX_TRACES = 10_000;

/**
 * Record a cache operation
 */
export function recordCacheOp(params: {
    sessionId: string;
    provider: string;
    model: string;
    operation: CacheTraceEntry['operation'];
    tokensSaved?: number;
    cacheKey?: string;
    metadata?: Record<string, unknown>;
}): CacheTraceEntry {
    const entry: CacheTraceEntry = {
        id: `ct_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        sessionId: params.sessionId,
        provider: params.provider,
        model: params.model,
        operation: params.operation,
        tokensSaved: params.tokensSaved ?? 0,
        cacheKey: params.cacheKey,
        timestamp: Date.now(),
        metadata: params.metadata,
    };

    traces.push(entry);
    if (traces.length > MAX_TRACES) {
        traces.splice(0, traces.length - MAX_TRACES);
    }

    log.debug({
        operation: entry.operation,
        provider: entry.provider,
        tokensSaved: entry.tokensSaved,
    }, 'Cache operation recorded');

    return entry;
}

/**
 * Record a cache hit
 */
export function recordCacheHit(params: {
    sessionId: string;
    provider: string;
    model: string;
    tokensSaved: number;
    cacheKey?: string;
}): CacheTraceEntry {
    return recordCacheOp({ ...params, operation: 'hit' });
}

/**
 * Record a cache miss
 */
export function recordCacheMiss(params: {
    sessionId: string;
    provider: string;
    model: string;
    cacheKey?: string;
}): CacheTraceEntry {
    return recordCacheOp({ ...params, operation: 'miss', tokensSaved: 0 });
}

/**
 * Get trace statistics
 */
export function getCacheTraceStats(sessionId?: string): CacheTraceStats {
    const filtered = sessionId
        ? traces.filter((t) => t.sessionId === sessionId)
        : traces;

    const hits = filtered.filter((t) => t.operation === 'hit').length;
    const misses = filtered.filter((t) => t.operation === 'miss').length;
    const evictions = filtered.filter((t) => t.operation === 'evict').length;
    const totalTokensSaved = filtered
        .filter((t) => t.operation === 'hit')
        .reduce((sum, t) => sum + t.tokensSaved, 0);

    const byProvider: Record<string, { hits: number; misses: number; tokensSaved: number }> = {};
    for (const trace of filtered) {
        if (!byProvider[trace.provider]) {
            byProvider[trace.provider] = { hits: 0, misses: 0, tokensSaved: 0 };
        }
        const providerStats = byProvider[trace.provider]!;
        if (trace.operation === 'hit') {
            providerStats.hits++;
            providerStats.tokensSaved += trace.tokensSaved;
        } else if (trace.operation === 'miss') {
            providerStats.misses++;
        }
    }

    return {
        totalOperations: filtered.length,
        hits,
        misses,
        hitRate: hits + misses > 0 ? hits / (hits + misses) : 0,
        totalTokensSaved,
        evictions,
        byProvider,
    };
}

/**
 * Get recent traces for a session
 */
export function getRecentTraces(sessionId: string, limit: number = 50): CacheTraceEntry[] {
    return traces
        .filter((t) => t.sessionId === sessionId)
        .slice(-limit);
}

/**
 * Clear all traces
 */
export function clearCacheTraces(): void {
    traces.length = 0;
}

/**
 * Format trace stats for display
 */
export function formatCacheTraceStats(stats: CacheTraceStats): string {
    const lines = [
        '📊 **Cache Trace Stats**',
        '',
        `- Operations: ${stats.totalOperations}`,
        `- Hit Rate: ${(stats.hitRate * 100).toFixed(1)}% (${stats.hits}/${stats.hits + stats.misses})`,
        `- Tokens Saved: ${stats.totalTokensSaved.toLocaleString()}`,
        `- Evictions: ${stats.evictions}`,
    ];

    if (Object.keys(stats.byProvider).length > 0) {
        lines.push('', '**By Provider:**');
        for (const [provider, provStats] of Object.entries(stats.byProvider)) {
            const rate = provStats.hits + provStats.misses > 0
                ? ((provStats.hits / (provStats.hits + provStats.misses)) * 100).toFixed(1)
                : '0.0';
            lines.push(`- ${provider}: ${rate}% hit rate, ${provStats.tokensSaved.toLocaleString()} tokens saved`);
        }
    }

    return lines.join('\n');
}
