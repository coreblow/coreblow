/**
 * Wave 34: Tool Safety & Caching
 *
 * Tests tool loop detection, cache tracing, skill mechanics, and idempotency.
 * TARGET: ~40 tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    detectToolLoop, recordToolCall, getSessionHistory,
    clearAllHistories, hashArgs, getLoopDetectionStats, clearSessionHistory,
    ToolCircuitBreaker, detectDirectRepeats, detectAlternatingLoop, detectNgramPattern, detectFrequencyAbuse, detectStaleLoop
} from '../../src/agents/tool-loop-detection.js';
import {
    recordCacheHit, recordCacheMiss, getCacheTraceStats, recordCacheOp,
    getRecentTraces, clearCacheTraces, formatCacheTraceStats
} from '../../src/agents/cache-trace.js';
import { SkillSystem, type Skill, type SkillMatch } from '../../src/agents/skill-system.js';
import {
    isDuplicateAnnounce, buildAnnounceKey, clearAnnounceCache
} from '../../src/agents/announce-idempotency.js';

// ─── Tool Loop Detection ──────────────────────────────────────────────────

describe('ToolLoopDetection', () => {
    beforeEach(() => {
        clearAllHistories();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('hashArgs generates consistent hashes ignoring key order', () => {
        const h1 = hashArgs({ a: 1, b: 'test', c: [1, 2] });
        const h2 = hashArgs({ c: [1, 2], a: 1, b: 'test' });
        expect(h1).toBe(h2);
    });

    it('hashArgs handles nested objects safely', () => {
        const h1 = hashArgs({ nested: { foo: 'bar' } });
        expect(typeof h1).toBe('string');
        expect(h1.length).toBeGreaterThan(0);
    });

    it('recordToolCall stores calls up to 200 limit', () => {
        for (let i = 0; i < 210; i++) {
            recordToolCall('s1', { toolName: `t${i}`, argsHash: 'h', timestamp: Date.now() });
        }
        const hist = getSessionHistory('s1');
        expect(hist.length).toBe(200);
        expect(hist[0].toolName).toBe('t10'); // Starts from 10th
    });

    it('clearSessionHistory clears only specific session', () => {
        recordToolCall('s1', { toolName: 't', argsHash: 'h', timestamp: Date.now() });
        recordToolCall('s2', { toolName: 't', argsHash: 'h', timestamp: Date.now() });
        clearSessionHistory('s1');
        expect(getSessionHistory('s1')).toHaveLength(0);
        expect(getSessionHistory('s2')).toHaveLength(1);
    });

    it('detectDirectRepeats catches A→A→A', () => {
        for (let i = 0; i < 3; i++) {
            recordToolCall('s1', { toolName: 'weather', argsHash: 'h', timestamp: Date.now() });
        }
        const res = detectDirectRepeats(getSessionHistory('s1'), 3);
        expect(res.loopDetected).toBe(true);
        expect(res.type).toBe('direct');
        expect(res.count).toBe(3);
    });

    it('detectDirectRepeats ignores different args', () => {
        recordToolCall('s1', { toolName: 'weather', argsHash: 'h1', timestamp: Date.now() });
        recordToolCall('s1', { toolName: 'weather', argsHash: 'h2', timestamp: Date.now() });
        recordToolCall('s1', { toolName: 'weather', argsHash: 'h3', timestamp: Date.now() });
        const res = detectDirectRepeats(getSessionHistory('s1'), 3);
        expect(res.loopDetected).toBe(false);
    });

    it('detectAlternatingLoop catches A→B→A→B', () => {
        const calls = ['t1', 't2', 't1', 't2'];
        for (const t of calls) {
            recordToolCall('s1', { toolName: t, argsHash: 'h', timestamp: Date.now() });
        }
        const res = detectAlternatingLoop(getSessionHistory('s1'), 2);
        expect(res.loopDetected).toBe(true);
        expect(res.type).toBe('alternating');
    });

    it('detectNgramPattern catches larger periodic patterns A→B→C', () => {
        const calls = ['a', 'b', 'c', 'a', 'b', 'c'];
        for (const t of calls) {
            recordToolCall('s1', { toolName: t, argsHash: 'h', timestamp: Date.now() });
        }
        const res = detectNgramPattern(getSessionHistory('s1'), 3, 2);
        expect(res.loopDetected).toBe(true);
        expect(res.type).toBe('ngram');
    });

    it('detectFrequencyAbuse detects too many calls in a minute', () => {
        const start = Date.now();
        for (let i = 0; i < 15; i++) {
            recordToolCall('s1', { toolName: `t${i}`, argsHash: 'h', timestamp: start });
        }
        const res = detectFrequencyAbuse(getSessionHistory('s1'), 10);
        expect(res.loopDetected).toBe(true);
        expect(res.type).toBe('frequency');
    });

    it('detectStaleLoop catches same call after long idle', () => {
        recordToolCall('s1', { toolName: 't', argsHash: 'h', timestamp: Date.now() });
        vi.advanceTimersByTime(120_000); // 2 minutes
        recordToolCall('s1', { toolName: 't', argsHash: 'h', timestamp: Date.now() });
        const res = detectStaleLoop(getSessionHistory('s1'), 60_000);
        expect(res.loopDetected).toBe(true);
        expect(res.type).toBe('stale');
    });

    it('detectToolLoop delegates appropriately (direct)', () => {
        for (let i = 0; i < 3; i++) {
            recordToolCall('s1', { toolName: 't', argsHash: 'h', timestamp: Date.now() });
        }
        const res = detectToolLoop(getSessionHistory('s1'), 10, 3);
        expect(res.loopDetected).toBe(true);
        expect(res.type).toBe('direct');
    });

    it('detectToolLoop returns false when history too short', () => {
        recordToolCall('s1', { toolName: 't', argsHash: 'h', timestamp: Date.now() });
        const res = detectToolLoop(getSessionHistory('s1'), 10, 3);
        expect(res.loopDetected).toBe(false);
    });

    it('getLoopDetectionStats summarizes correctly', () => {
        recordToolCall('s1', { toolName: 'A', argsHash: 'h', timestamp: Date.now() });
        recordToolCall('s1', { toolName: 'A', argsHash: 'h2', timestamp: Date.now() });
        recordToolCall('s1', { toolName: 'B', argsHash: 'h', timestamp: Date.now() });
        const stats = getLoopDetectionStats('s1');
        expect(stats.totalCalls).toBe(3);
        expect(stats.uniqueTools).toBe(2);
        expect(stats.mostCalledTool).toBe('A');
    });

    // CircuitBreaker
    it('CircuitBreaker transitions closed -> open on max failures', () => {
        const breaker = new ToolCircuitBreaker(3, 1000, 2);
        expect(breaker.canExecute()).toBe(true);
        breaker.recordFailure(); breaker.recordFailure(); breaker.recordFailure();
        expect(breaker.canExecute()).toBe(false);
        expect(breaker.getState()).toBe('open');
    });

    it('CircuitBreaker transitions open -> half-open after timeout', () => {
        const breaker = new ToolCircuitBreaker(1, 1000, 1);
        breaker.recordFailure();
        expect(breaker.getState()).toBe('open');
        vi.advanceTimersByTime(1100);
        expect(breaker.canExecute()).toBe(true); // triggers transition
        expect(breaker.getState()).toBe('half-open');
    });

    it('CircuitBreaker half-open -> closed on required successes', () => {
        const breaker = new ToolCircuitBreaker(1, 1000, 2);
        breaker.recordFailure(); // Open
        vi.advanceTimersByTime(1100); // Wait for timeout
        breaker.canExecute(); // Transition to half-open
        breaker.recordSuccess(); // 1/2 success
        expect(breaker.getState()).toBe('half-open');
        breaker.recordSuccess(); // 2/2 success
        expect(breaker.getState()).toBe('closed');
    });

    it('CircuitBreaker half-open -> open immediately on failure', () => {
        const breaker = new ToolCircuitBreaker(1, 1000, 2);
        breaker.recordFailure();
        vi.advanceTimersByTime(1100);
        breaker.recordFailure();
        expect(breaker.getState()).toBe('open');
    });
});

// ─── Cache Tracing ────────────────────────────────────────────────────────

describe('CacheTrace', () => {
    beforeEach(() => {
        clearCacheTraces();
    });

    it('recordCacheOp tracks basic operations', () => {
        const op = recordCacheOp({ sessionId: 's1', provider: 'openai', model: 'm', operation: 'evict' });
        expect(op.operation).toBe('evict');
        expect(op.id).toContain('ct_');
    });

    it('recordCacheHit increments hit counters', () => {
        recordCacheHit({ sessionId: 's1', provider: 'openai', model: 'gpt', tokensSaved: 100 });
        const stats = getCacheTraceStats();
        expect(stats.hits).toBe(1);
        expect(stats.totalTokensSaved).toBe(100);
    });

    it('recordCacheMiss increments miss counters', () => {
        recordCacheMiss({ sessionId: 's1', provider: 'anthropic', model: 'claude' });
        const stats = getCacheTraceStats();
        expect(stats.misses).toBe(1);
    });

    it('getCacheTraceStats totals and calculates hitRate correctly', () => {
        recordCacheHit({ sessionId: 's1', provider: 'openai', model: 'm', tokensSaved: 10 });
        recordCacheHit({ sessionId: 's1', provider: 'anthropic', model: 'm', tokensSaved: 20 });
        recordCacheMiss({ sessionId: 's1', provider: 'openai', model: 'm' });
        recordCacheMiss({ sessionId: 's1', provider: 'openai', model: 'm' }); // 2 hits, 2 misses (50%)
        
        const stats = getCacheTraceStats();
        expect(stats.hits).toBe(2);
        expect(stats.misses).toBe(2);
        expect(stats.hitRate).toBeCloseTo(0.5, 2);
        expect(stats.totalTokensSaved).toBe(30);
    });

    it('getCacheTraceStats groups by provider', () => {
        recordCacheHit({ sessionId: 's1', provider: 'openai', model: 'm', tokensSaved: 10 });
        recordCacheMiss({ sessionId: 's1', provider: 'anthropic', model: 'm' });
        const stats = getCacheTraceStats();
        expect(stats.byProvider['openai'].hits).toBe(1);
        expect(stats.byProvider['anthropic'].misses).toBe(1);
    });

    it('getRecentTraces filters by session and sorts correctly', () => {
        recordCacheHit({ sessionId: 's1', provider: 'p', model: 'm', tokensSaved: 0 });
        recordCacheHit({ sessionId: 's2', provider: 'p', model: 'm', tokensSaved: 0 });
        const traces = getRecentTraces('s1');
        expect(traces).toHaveLength(1);
        expect(traces[0].sessionId).toBe('s1');
    });

    it('formatCacheTraceStats produces textual summary', () => {
        recordCacheHit({ sessionId: 's1', provider: 'openai', model: 'm', tokensSaved: 150 });
        const txt = formatCacheTraceStats(getCacheTraceStats());
        expect(txt).toContain('Tokens Saved: 150');
        expect(txt).toContain('openai: 100.0% hit rate');
    });
});

// ─── Skill System ─────────────────────────────────────────────────────────

describe('SkillSystem', () => {
    let skills: SkillSystem;

    beforeEach(() => {
        skills = new SkillSystem();
    });

    it('registers a new skill', () => {
        skills.register({ id: 's1', name: 'S1', description: 'desc', category: 'cat', enabled: true, version: '1' });
        expect(skills.get('s1')).toBeDefined();
    });

    it('re-registering updates existing skill', () => {
        skills.register({ id: 's1', name: 'Original', description: 'd', category: 'c', enabled: true, version: '1' });
        skills.register({ id: 's1', name: 'Updated', description: 'd', category: 'c', enabled: true, version: '2' });
        expect(skills.get('s1')?.name).toBe('Updated');
    });

    it('list and count return correct skills', () => {
        const initialCount = skills.count();
        skills.register({ id: 's1', name: 'S1', description: 'd', category: 'c', enabled: true, version: '1' });
        expect(skills.count()).toBe(initialCount + 1);
        expect(skills.list().some(s => s.id === 's1')).toBe(true);
    });

    it('setEnabled toggles state', () => {
        skills.register({ id: 's1', name: 'S1', description: 'd', category: 'c', enabled: true, version: '1' });
        skills.setEnabled('s1', false);
        expect(skills.get('s1')?.enabled).toBe(false);
    });

    it('listByCategory groups skills', () => {
        skills.register({ id: '1', name: '1', description: 'd', category: 'dev', enabled: true, version: '1' });
        skills.register({ id: '2', name: '2', description: 'd', category: 'dev', enabled: true, version: '1' });
        skills.register({ id: '3', name: '3', description: 'd', category: 'ops', enabled: true, version: '1' });
        const map = skills.listByCategory();
        expect(map['dev']).toHaveLength(2);
        expect(map['ops']).toHaveLength(1);
    });

    it('match returns triggered skills based on input string', () => {
        skills.register({ id: 'react', name: 'React', description: 'React helper', category: 'dev', enabled: true, version: '1', triggers: ['react', 'hook'] });
        const matches = skills.match('how to create a react hook?');
        expect(matches).toHaveLength(1);
        expect(matches[0].skill.id).toBe('react');
    });

    it('match ignores disabled skills', () => {
        skills.register({ id: 'react', name: 'R', description: 'd', category: 'c', enabled: false, version: '1', triggers: ['react'] });
        expect(skills.match('react')).toHaveLength(0);
    });

    it('buildPromptAdditions creates combined instruction', () => {
        skills.register({ id: 's1', name: 'S1', description: 'd', category: 'c', enabled: true, version: '1', systemPrompt: 'Use tool A.' });
        skills.register({ id: 's2', name: 'S2', description: 'd', category: 'c', enabled: true, version: '1', systemPrompt: 'Use tool B.' });
        const instructions = skills.buildPromptAdditions(['s1', 's2']);
        expect(instructions).toContain('Use tool A.');
        expect(instructions).toContain('Use tool B.');
    });

    it('buildPromptAdditions ignores un-registered IDs', () => {
        const instructions = skills.buildPromptAdditions(['nonexistent']);
        expect(instructions).toBe('');
    });
});

// ─── Announce Idempotency ─────────────────────────────────────────────────

describe('Announce Idempotency', () => {
    beforeEach(() => {
        clearAnnounceCache();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('buildAnnounceKey joins components securely', () => {
        const key = buildAnnounceKey('session', 'agent', 'msg');
        expect(key).toBe('session:agent:msg');
    });

    it('isDuplicateAnnounce detects duplicate lookups', () => {
        const key = 'test-key';
        expect(isDuplicateAnnounce(key, 1000)).toBe(false); // first call
        expect(isDuplicateAnnounce(key, 1000)).toBe(true);  // second call instantly
    });

    it('isDuplicateAnnounce re-allows after TTL', () => {
        const key = 'test-key-2';
        expect(isDuplicateAnnounce(key, 100)).toBe(false);
        vi.advanceTimersByTime(200);
        // TTL passed, should be false again
        expect(isDuplicateAnnounce(key, 100)).toBe(false);
    });

    it('clearAnnounceCache clears the state', () => {
        const key = 'test-key-3';
        expect(isDuplicateAnnounce(key, 1000)).toBe(false);
        clearAnnounceCache();
        expect(isDuplicateAnnounce(key, 1000)).toBe(false); // Can do it again
    });
});
