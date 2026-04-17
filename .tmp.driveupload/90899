/**
 * agents/debug-stress.test.ts
 * Stress tests & edge cases for Phase A critical modules.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Compaction Edge Cases ───
import { estimateTokens, estimateMessagesTokens, splitMessagesByTokenShare, chunkMessagesByMaxTokens, pruneHistoryForContextShare, type CompactionMessage } from './compaction.js';

describe('Compaction — stress', () => {
    const makeMsg = (content: string, role = 'user'): CompactionMessage => ({ role, content, timestamp: Date.now() });

    it('handles 1000 messages', () => {
        const msgs = Array.from({ length: 1000 }, (_, i) => makeMsg(`msg ${i} ${'x'.repeat(100)}`));
        const tokens = estimateMessagesTokens(msgs);
        expect(tokens).toBeGreaterThan(10000);
    });

    it('split with empty array', () => { expect(splitMessagesByTokenShare([], 5)).toEqual([]); });
    it('split with 1 message', () => { expect(splitMessagesByTokenShare([makeMsg('a')], 5)).toHaveLength(1); });
    it('chunk with single huge message', () => {
        const msgs = [makeMsg('x'.repeat(50_000))];
        const chunks = chunkMessagesByMaxTokens(msgs, 100);
        expect(chunks).toHaveLength(1); // single msg can't be split
    });

    it('prune preserves at least last message', () => {
        const msgs = Array.from({ length: 50 }, (_, i) => makeMsg(`msg ${i} ${'y'.repeat(500)}`));
        const result = pruneHistoryForContextShare({ messages: msgs, maxContextTokens: 100, maxHistoryShare: 0.1 });
        expect(result.messages.length).toBeGreaterThanOrEqual(1);
    });

    it('estimates tokens for empty string', () => { expect(estimateTokens(makeMsg(''))).toBeGreaterThan(0); /* overhead */ });
    it('estimates tokens for unicode', () => { expect(estimateTokens(makeMsg('日本語テスト🎉'))).toBeGreaterThan(0); });
});

// ─── Bash Process Registry Edge Cases ───
import { addSession, getSession, appendOutput, drainSession, markExited, markBackgrounded, resetProcessRegistryForTests, type ProcessSession } from './bash-process-registry.js';

describe('Bash Process Registry — stress', () => {
    beforeEach(() => resetProcessRegistryForTests());

    function makeSession(id: string): ProcessSession {
        return { id, command: 'echo', startedAt: Date.now(), maxOutputChars: 100, totalOutputChars: 0, pendingStdout: [], pendingStderr: [], pendingStdoutChars: 0, pendingStderrChars: 0, aggregated: '', tail: '', exited: false, truncated: false, backgrounded: false };
    }

    it('handles rapid append/drain cycles', () => {
        const session = makeSession('rapid');
        addSession(session);
        for (let i = 0; i < 100; i++) {
            appendOutput(session, 'stdout', `chunk-${i} `);
            if (i % 10 === 0) drainSession(session);
        }
        expect(session.totalOutputChars).toBeGreaterThan(0);
    });

    it('truncation kicks in cleanly', () => {
        const session = makeSession('trunc');
        session.maxOutputChars = 50;
        appendOutput(session, 'stdout', 'a'.repeat(30));
        appendOutput(session, 'stdout', 'b'.repeat(30));
        expect(session.truncated).toBe(true);
        expect(session.aggregated.length).toBeLessThanOrEqual(50);
    });

    it('double exit is no-op', () => {
        const session = makeSession('dbl');
        addSession(session);
        markBackgrounded(session);
        markExited(session, 0, null, 'completed');
        expect(session.exited).toBe(true);
        // second exit should not throw
        markExited(session, 1, null, 'failed');
    });

    it('drain on empty is safe', () => {
        const session = makeSession('empty');
        const { stdout, stderr } = drainSession(session);
        expect(stdout).toBe('');
        expect(stderr).toBe('');
    });
});

// ─── Tool Loop Detection Edge Cases ───
import { detectToolLoop, ToolCircuitBreaker } from './tool-loop-detection.js';

describe('Tool Loop Detection — stress', () => {
    it('no loop on diverse calls', () => {
        const calls = Array.from({ length: 50 }, (_, i) => ({ toolName: `tool_${i}`, argsHash: `hash_${i}`, timestamp: Date.now() + i }));
        const result = detectToolLoop(calls, 100, 3);
        expect(result.loopDetected).toBe(false);
    });

    it('detects loop in repetitive calls', () => {
        const calls = Array.from({ length: 20 }, (_, i) => ({ toolName: 'bash', argsHash: 'same', timestamp: Date.now() + i }));
        const result = detectToolLoop(calls, 5, 3);
        expect(result.loopDetected).toBe(true);
    });

    it('circuit breaker state transitions', () => {
        const cb = new ToolCircuitBreaker(3, 10_000, 2);
        expect(cb.isOpen()).toBe(false);
        cb.recordFailure(); cb.recordFailure(); cb.recordFailure();
        expect(cb.isOpen()).toBe(true);
        cb.recordSuccess(); cb.recordSuccess();
        expect(cb.isOpen()).toBe(false);
    });
});

// ─── Auth Health Edge Cases ───
import { buildAuthHealthSummary, formatAuthHealthSummary, type AuthProfileStore } from './auth-health.js';

describe('Auth Health — stress', () => {
    it('handles 50 profiles', () => {
        const profiles: Record<string, { provider: string; type: 'api_key' }> = {};
        for (let i = 0; i < 50; i++) profiles[`p${i}`] = { provider: `provider_${i % 5}`, type: 'api_key' };
        const summary = buildAuthHealthSummary({ store: { profiles } });
        expect(summary.profiles).toHaveLength(50);
        expect(summary.providers.length).toBeLessThanOrEqual(5);
    });

    it('mixed statuses provider aggregation', () => {
        const store: AuthProfileStore = {
            profiles: {
                ok: { provider: 'openai', type: 'token', expires: Date.now() + 999_999_999 },
                expiring: { provider: 'openai', type: 'token', expires: Date.now() + 3600_000 },
                expired: { provider: 'openai', type: 'token', expires: Date.now() - 10_000 },
            },
        };
        const summary = buildAuthHealthSummary({ store });
        expect(summary.providers[0].status).toBe('expired'); // worst wins
    });
});

// ─── Sandbox Edge Cases ───
import { Sandbox, createDefaultSandbox } from './sandbox.js';
import { isPathTraversal, ensureWithinBase } from './sandbox-paths.js';

describe('Sandbox — stress', () => {
    it('blocks null bytes', () => { expect(isPathTraversal('file\0.txt')).toBe(true); });
    it('blocks parent traversal', () => { expect(isPathTraversal('../../../etc/passwd')).toBe(true); });
    it('deep nested allowed', () => {
        const s = createDefaultSandbox('/tmp/ws');
        expect(s.isPathAllowed('/tmp/ws/a/b/c/d/e/f.ts').allowed).toBe(true);
    });
    it('symlink-like path', () => {
        const { valid } = ensureWithinBase('src/../../../etc/passwd', '/tmp/ws');
        expect(valid).toBe(false);
    });
    it('file size validation', () => {
        const s = createDefaultSandbox('/tmp/ws');
        expect(s.validateFileSize(1000)).toBe(true);
        expect(s.validateFileSize(100_000_000)).toBe(false);
    });
});

// ─── ToolPolicy Edge Cases ───
import { ToolPolicy, isDangerousTool } from './tool-policy.js';

describe('ToolPolicy — stress', () => {
    it('priority ordering', () => {
        const p = new ToolPolicy([
            { toolPattern: 'bash', decision: 'deny', priority: 1 },
            { toolPattern: 'bash', decision: 'allow', priority: 10 },
        ]);
        expect(p.evaluate('bash').decision).toBe('allow'); // higher priority wins
    });

    it('wildcard patterns', () => {
        const p = new ToolPolicy([{ toolPattern: '*', decision: 'require_approval' }]);
        expect(p.evaluate('anything').decision).toBe('require_approval');
    });

    it('suffix wildcard', () => {
        const p = new ToolPolicy([{ toolPattern: '*_file', decision: 'deny' }]);
        expect(p.evaluate('write_file').decision).toBe('deny');
        expect(p.evaluate('bash').decision).toBe('allow'); // default
    });
});

// ─── BootstrapCache Edge Cases ───
import { BootstrapCache } from './bootstrap-cache.js';

describe('BootstrapCache — stress', () => {
    it('handles 1000 entries with eviction', () => {
        const cache = new BootstrapCache<number>(100);
        for (let i = 0; i < 1000; i++) cache.set(`k${i}`, i);
        expect(cache.size()).toBe(100);
        expect(cache.get('k999')).toBe(999);
        expect(cache.get('k0')).toBeUndefined(); // evicted
    });

    it('concurrent-like set/get/prune', () => {
        vi.useFakeTimers();
        const cache = new BootstrapCache<string>(50, 100);
        for (let i = 0; i < 50; i++) cache.set(`k${i}`, `v${i}`);
        vi.advanceTimersByTime(150);
        const pruned = cache.prune();
        expect(pruned).toBe(50);
        expect(cache.size()).toBe(0);
        vi.useRealTimers();
    });
});

// ─── Internal Events Edge Cases ───
import { InternalEventBus } from './internal-events.js';

describe('InternalEventBus — stress', () => {
    it('100 listeners on same event', async () => {
        const bus = new InternalEventBus();
        let count = 0;
        for (let i = 0; i < 100; i++) bus.on('evt', () => { count++; });
        await bus.emit('evt', null);
        expect(count).toBe(100);
    });

    it('unsubscribe mid-fire is safe', async () => {
        const bus = new InternalEventBus();
        const unsub = bus.on('evt', () => { unsub(); });
        await bus.emit('evt', null); // should not throw
    });

    it('error in handler does not break others', () => {
        const bus = new InternalEventBus();
        let called = false;
        bus.on('evt', () => { throw new Error('boom'); });
        bus.on('evt', () => { called = true; });
        // emitSync catches errors
        bus.emitSync('evt', null);
        expect(called).toBe(true);
    });
});

// ─── Usage Tracker Edge Cases ───
import { UsageTracker } from './usage.js';

describe('UsageTracker — stress', () => {
    it('1000 records', () => {
        const u = new UsageTracker();
        for (let i = 0; i < 1000; i++) u.record({ inputTokens: 100, outputTokens: 50, cost: 0.001, model: `m${i % 3}` });
        const s = u.getSummary();
        expect(s.turns).toBe(1000);
        expect(s.totalInputTokens).toBe(100_000);
        expect(s.byModel.size).toBe(3);
    });

    it('reset clears everything', () => {
        const u = new UsageTracker();
        u.record({ inputTokens: 1, outputTokens: 1 });
        u.reset();
        expect(u.getRecords()).toHaveLength(0);
    });
});

// ─── Glob Pattern Edge Cases ───
import { globMatch } from './glob-pattern.js';

describe('Glob — stress', () => {
    it('exact match', () => { expect(globMatch('foo.ts', 'foo.ts')).toBe(true); });
    it('star extension', () => { expect(globMatch('*.test.ts', 'foo.test.ts')).toBe(true); });
    it('no false positive', () => { expect(globMatch('*.ts', 'foo.js')).toBe(false); });
    it('question mark', () => { expect(globMatch('?.ts', 'a.ts')).toBe(true); expect(globMatch('?.ts', 'ab.ts')).toBe(false); });
    it('bracket as char class (glob semantics)', () => { expect(globMatch('file[1].ts', 'file1.ts')).toBe(true); });
});

// ─── Payload Redaction Edge Cases ───
import { redactPayload } from './payload-redaction.js';

describe('Payload Redaction — stress', () => {
    it('deeply nested', () => {
        const deep = { a: { b: { c: { d: { api_key: 'secret' } } } } };
        const result = redactPayload(deep) as any;
        expect(result.a.b.c.d.api_key).toBe('[REDACTED]');
    });

    it('handles arrays with sensitive data', () => {
        const data = [{ token: 'x' }, { name: 'safe' }];
        const result = redactPayload(data) as any[];
        expect(result[0].token).toBe('[REDACTED]');
        expect(result[1].name).toBe('safe');
    });

    it('truncates long strings', () => {
        const data = { text: 'x'.repeat(5000) };
        const result = redactPayload(data) as any;
        expect(result.text.length).toBeLessThan(5000);
        expect(result.text).toContain('chars');
    });

    it('max depth protection', () => {
        let obj: any = { val: 'deep' };
        for (let i = 0; i < 20; i++) obj = { nested: obj };
        const result = redactPayload(obj) as any;
        expect(JSON.stringify(result)).toContain('MAX_DEPTH');
    });
});

// ─── LaneManager Edge Cases ───
import { LaneManager } from './lanes.js';

describe('LaneManager — stress', () => {
    it('rapid acquire/release cycle', () => {
        const m = new LaneManager(3);
        for (let i = 0; i < 100; i++) {
            const l = m.acquire(`agent_${i}`);
            if (l) m.release(l.id);
        }
        expect(m.busyCount()).toBe(0);
    });

    it('pause/resume', () => {
        const m = new LaneManager(2);
        const l = m.acquire('a')!;
        m.pause(l.id);
        expect(m.get(l.id)?.status).toBe('paused');
        // paused lane doesn't count as busy for slot allocation (still in lanes though)
        m.resume(l.id);
        expect(m.get(l.id)?.status).toBe('busy');
    });
});
