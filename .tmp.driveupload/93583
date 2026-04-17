/**
 * Tests: Context Engine — Window manager, Search, Summarizer
 */
import { describe, it, expect } from 'vitest';
import { ContextWindowManager, getContextWindowManager } from '../../src/context-engine/context-window.js';
import { searchContext, findByRole, findToolResults, contextStats } from '../../src/context-engine/context-search.js';
import { defaultSummarizer, partitionForSummary } from '../../src/context-engine/context-summarizer.js';
import type { ContextEntry } from '../../src/context-engine/types.js';

// ═══════════════════════════════════════════════════════════════
// CONTEXT WINDOW MANAGER
// ═══════════════════════════════════════════════════════════════

describe('ContextWindowManager', () => {
    it('creates a window', () => {
        const mgr = new ContextWindowManager();
        const win = mgr.create('s1', 'gpt-4');
        expect(win).toBeDefined();
        expect(win.entries).toEqual([]);
        expect(win.model).toBe('gpt-4');
    });

    it('getOrCreate returns existing', () => {
        const mgr = new ContextWindowManager();
        mgr.create('s2', 'gpt-4');
        const w = mgr.getOrCreate('s2', 'gpt-4');
        expect(w.model).toBe('gpt-4');
    });

    it('getOrCreate creates new if missing', () => {
        const mgr = new ContextWindowManager();
        const w = mgr.getOrCreate('new-session', 'gpt-4');
        expect(w).toBeDefined();
    });

    it('adds entry to window', () => {
        const mgr = new ContextWindowManager();
        mgr.create('s3', 'gpt-4');
        mgr.addEntry('s3', {
            role: 'user', content: 'Hello', timestamp: Date.now(), tokens: 5,
        });
        const messages = mgr.getMessages('s3');
        expect(messages.length).toBe(1);
        expect(messages[0].content).toBe('Hello');
    });

    it('tracks token count', () => {
        const mgr = new ContextWindowManager();
        mgr.create('s4', 'gpt-4');
        mgr.addEntry('s4', {
            role: 'user', content: 'Test', timestamp: Date.now(), tokens: 10,
        });
        expect(mgr.getTokenCount('s4')).toBe(10);
    });

    it('returns 0 tokens for unknown session', () => {
        const mgr = new ContextWindowManager();
        expect(mgr.getTokenCount('nonexistent')).toBe(0);
    });

    it('getContextWindowManager returns singleton', () => {
        expect(getContextWindowManager()).toBe(getContextWindowManager());
    });
});

// ═══════════════════════════════════════════════════════════════
// CONTEXT SEARCH
// ═══════════════════════════════════════════════════════════════

const testEntries: ContextEntry[] = [
    { role: 'system', content: 'You are a helpful assistant', timestamp: 1000, tokens: 10 },
    { role: 'user', content: 'What is TypeScript?', timestamp: 2000, tokens: 5 },
    { role: 'assistant', content: 'TypeScript is a typed superset of JavaScript', timestamp: 3000, tokens: 10 },
    { role: 'tool', content: 'search results: TypeScript documentation', timestamp: 4000, tokens: 8, toolCallId: 'tc1' },
    { role: 'user', content: 'Tell me about Node.js', timestamp: 5000, tokens: 6 },
];

describe('searchContext', () => {
    it('searches entries by query', () => {
        const results = searchContext(testEntries, 'TypeScript');
        expect(results.length).toBeGreaterThan(0);
    });

    it('returns limited results', () => {
        const results = searchContext(testEntries, 'a', 2);
        expect(results.length).toBeLessThanOrEqual(2);
    });
});

describe('findByRole', () => {
    it('finds user messages', () => {
        const users = findByRole(testEntries, 'user');
        expect(users.every(e => e.role === 'user')).toBe(true);
        expect(users.length).toBe(2);
    });

    it('finds system messages', () => {
        expect(findByRole(testEntries, 'system')).toHaveLength(1);
    });
});

describe('findToolResults', () => {
    it('finds tool entries', () => {
        const tools = findToolResults(testEntries);
        expect(tools.length).toBe(1);
        expect(tools[0].role).toBe('tool');
    });
});

describe('contextStats', () => {
    it('returns entry statistics', () => {
        const stats = contextStats(testEntries);
        expect(stats.total).toBe(5);
        expect(stats.totalTokens).toBe(39);
    });
});

// ═══════════════════════════════════════════════════════════════
// CONTEXT SUMMARIZER
// ═══════════════════════════════════════════════════════════════

describe('defaultSummarizer', () => {
    it('produces a summary string', () => {
        const summary = defaultSummarizer(testEntries);
        expect(typeof summary).toBe('string');
        expect(summary.length).toBeGreaterThan(0);
    });
});

describe('partitionForSummary', () => {
    it('partitions entries', () => {
        const result = partitionForSummary(testEntries, 20);
        expect(result).toBeDefined();
    });
});
