/**
 * CoreBlow Security — File-Based AuditLogger + Compat API Test Suite
 *
 * Covers: AuditLogger class (log, query, getRecent, buffer eviction),
 * backward-compatible functions (audit, getAuditLog, readAuditLog, initAuditLogger),
 * fs mocking for file I/O, and error recovery paths.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Mock external dependencies
vi.mock('node:fs', () => {
    const memFs: Record<string, string> = {};
    return {
        default: {
            existsSync: vi.fn(() => false),
            readFileSync: vi.fn(() => ''),
            writeFileSync: vi.fn(),
            mkdirSync: vi.fn(),
            promises: {
                mkdir: vi.fn(async () => undefined),
                appendFile: vi.fn(async (filePath: string, data: string) => {
                    memFs[filePath] = (memFs[filePath] || '') + data;
                }),
                readFile: vi.fn(async (filePath: string) => {
                    if (memFs[filePath]) return memFs[filePath];
                    throw new Error('ENOENT');
                }),
            },
        },
        existsSync: vi.fn(() => false),
        readFileSync: vi.fn(() => ''),
        writeFileSync: vi.fn(),
        mkdirSync: vi.fn(),
        promises: {
            mkdir: vi.fn(async () => undefined),
            appendFile: vi.fn(async (filePath: string, data: string) => {
                memFs[filePath] = (memFs[filePath] || '') + data;
            }),
            readFile: vi.fn(async (filePath: string) => {
                if (memFs[filePath]) return memFs[filePath];
                throw new Error('ENOENT');
            }),
        },
    };
});

vi.mock('../utils/logger.js', () => ({
    createChildLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

// Import AFTER mocks
import { AuditLogger, audit, getAuditLog, readAuditLog, initAuditLogger, type AuditEntry } from './audit.js';

describe('AuditLogger (file-based)', () => {
    let logger: AuditLogger;

    beforeEach(() => {
        logger = new AuditLogger('/tmp/test-state');
        vi.clearAllMocks();
    });

    // ─── Constructor ────────────────────────────────────────────

    describe('constructor', () => {
        it('uses provided stateDir for log path', () => {
            const l = new AuditLogger('/my/state');
            expect((l as any).logPath).toBe(path.join('/my/state', 'audit'));
        });

        it('falls back to env vars when no stateDir provided', () => {
            const origState = process.env.COREBLOW_STATE_DIR;
            const origHome = process.env.COREBLOW_HOME;
            process.env.COREBLOW_STATE_DIR = '/env-state';
            delete process.env.COREBLOW_HOME;

            const l = new AuditLogger();
            expect((l as any).logPath).toBe(path.join('/env-state', 'audit'));

            process.env.COREBLOW_STATE_DIR = origState;
            process.env.COREBLOW_HOME = origHome;
        });

        it('defaults to "." when no stateDir or env vars', () => {
            const origState = process.env.COREBLOW_STATE_DIR;
            const origHome = process.env.COREBLOW_HOME;
            delete process.env.COREBLOW_STATE_DIR;
            delete process.env.COREBLOW_HOME;

            const l = new AuditLogger();
            expect((l as any).logPath).toBe(path.join('.', 'audit'));

            process.env.COREBLOW_STATE_DIR = origState;
            process.env.COREBLOW_HOME = origHome;
        });
    });

    // ─── log() ──────────────────────────────────────────────────

    describe('log()', () => {
        it('creates a complete AuditEntry with timestamp and defaults', async () => {
            await logger.log({ action: 'tool_call', tool: 'exec', result: 'success' });

            const recent = logger.getRecent(10);
            expect(recent.length).toBe(1);

            const entry = recent[0]!;
            expect(entry.action).toBe('tool_call');
            expect(entry.tool).toBe('exec');
            expect(entry.result).toBe('success');
            expect(entry.agentId).toBe('system'); // default
            expect(entry.timestamp).toBeTruthy();
        });

        it('preserves all optional fields', async () => {
            await logger.log({
                action: 'auth_attempt',
                agentId: 'agent-1',
                tool: 'bash',
                params: { cmd: 'ls' },
                result: 'denied',
                source: 'whatsapp:+62xxx',
                durationMs: 150,
                details: 'Permission denied',
                actor: 'user-1',
                target: '/etc/passwd',
            });

            const entry = logger.getRecent(1)[0]!;
            expect(entry.agentId).toBe('agent-1');
            expect(entry.source).toBe('whatsapp:+62xxx');
            expect(entry.durationMs).toBe(150);
            expect(entry.actor).toBe('user-1');
            expect(entry.target).toBe('/etc/passwd');
        });

        it('creates audit directory before writing', async () => {
            await logger.log({ action: 'test' });
            expect(fs.promises.mkdir).toHaveBeenCalledWith(
                expect.stringContaining('audit'),
                { recursive: true }
            );
        });

        it('appends JSONL to date-stamped file', async () => {
            await logger.log({ action: 'test-write' });
            expect(fs.promises.appendFile).toHaveBeenCalledWith(
                expect.stringMatching(/audit-\d{4}-\d{2}-\d{2}\.jsonl$/),
                expect.stringContaining('"action":"test-write"'),
                'utf-8'
            );
        });

        it('does not throw when fs write fails', async () => {
            vi.mocked(fs.promises.mkdir).mockRejectedValueOnce(new Error('EPERM'));

            await expect(logger.log({ action: 'fail-write' })).resolves.not.toThrow();

            // Event should still be in memory
            expect(logger.getRecent(10).length).toBe(1);
        });

        it('evicts oldest entries when buffer exceeds maxBuffer (1000)', async () => {
            (logger as any).maxBuffer = 5;

            for (let i = 0; i < 8; i++) {
                await logger.log({ action: `action-${i}` });
            }

            const recent = logger.getRecent(100);
            expect(recent.length).toBe(5);
            expect(recent[0]!.action).toBe('action-3');
        });
    });

    // ─── query() ────────────────────────────────────────────────

    describe('query()', () => {
        it('reads and parses JSONL file for given date', async () => {
            const today = new Date().toISOString().split('T')[0];
            const mockData = [
                JSON.stringify({ action: 'tool_call', agentId: 'a', result: 'success', timestamp: new Date().toISOString() }),
                JSON.stringify({ action: 'auth_attempt', agentId: 'b', result: 'denied', timestamp: new Date().toISOString() }),
            ].join('\n');

            vi.mocked(fs.promises.readFile).mockResolvedValueOnce(mockData);

            const results = await logger.query({ date: today });
            expect(results.length).toBe(2);
            expect(results[0]!.action).toBe('tool_call');
        });

        it('filters by action', async () => {
            const mockData = [
                JSON.stringify({ action: 'tool_call', agentId: 'a' }),
                JSON.stringify({ action: 'auth_attempt', agentId: 'b' }),
                JSON.stringify({ action: 'tool_call', agentId: 'c' }),
            ].join('\n');

            vi.mocked(fs.promises.readFile).mockResolvedValueOnce(mockData);

            const results = await logger.query({ action: 'tool_call' });
            expect(results.length).toBe(2);
        });

        it('filters by agentId', async () => {
            const mockData = [
                JSON.stringify({ action: 'a', agentId: 'agent-1' }),
                JSON.stringify({ action: 'b', agentId: 'agent-2' }),
            ].join('\n');

            vi.mocked(fs.promises.readFile).mockResolvedValueOnce(mockData);

            const results = await logger.query({ agentId: 'agent-1' });
            expect(results.length).toBe(1);
        });

        it('filters by result', async () => {
            const mockData = [
                JSON.stringify({ action: 'a', agentId: 'x', result: 'success' }),
                JSON.stringify({ action: 'b', agentId: 'x', result: 'denied' }),
            ].join('\n');

            vi.mocked(fs.promises.readFile).mockResolvedValueOnce(mockData);

            const results = await logger.query({ result: 'denied' });
            expect(results.length).toBe(1);
            expect(results[0]!.action).toBe('b');
        });

        it('respects limit', async () => {
            const mockData = Array.from({ length: 50 }, (_, i) =>
                JSON.stringify({ action: `action-${i}`, agentId: 'x' })
            ).join('\n');

            vi.mocked(fs.promises.readFile).mockResolvedValueOnce(mockData);

            const results = await logger.query({ limit: 5 });
            expect(results.length).toBe(5);
        });

        it('falls back to in-memory buffer when file does not exist', async () => {
            vi.mocked(fs.promises.readFile).mockRejectedValueOnce(new Error('ENOENT'));

            // Pre-fill memory buffer
            await logger.log({ action: 'mem-event-1' });
            await logger.log({ action: 'mem-event-2' });

            const results = await logger.query();
            expect(results.length).toBe(2);
            expect(results[0]!.action).toBe('mem-event-1');
        });

        it('defaults to today\'s date when no date filter provided', async () => {
            vi.mocked(fs.promises.readFile).mockRejectedValueOnce(new Error('ENOENT'));
            await logger.query();
            // Should have attempted to read today's file
            expect(fs.promises.readFile).toHaveBeenCalledWith(
                expect.stringMatching(/audit-\d{4}-\d{2}-\d{2}\.jsonl$/),
                'utf-8'
            );
        });
    });

    // ─── getRecent() ────────────────────────────────────────────

    describe('getRecent()', () => {
        it('returns last N entries from memory', async () => {
            await logger.log({ action: 'a' });
            await logger.log({ action: 'b' });
            await logger.log({ action: 'c' });

            const recent = logger.getRecent(2);
            expect(recent.length).toBe(2);
            expect(recent[0]!.action).toBe('b');
            expect(recent[1]!.action).toBe('c');
        });

        it('returns empty array when no events', () => {
            expect(logger.getRecent()).toEqual([]);
        });

        it('defaults limit to 100', async () => {
            for (let i = 0; i < 120; i++) {
                await logger.log({ action: `a${i}` });
            }
            expect(logger.getRecent().length).toBe(100);
        });
    });
});

// ─── Backward Compatible API ────────────────────────────────────

describe('backward-compatible API', () => {
    beforeEach(() => {
        // Reset the singleton
        initAuditLogger('/tmp/compat-test');
    });

    describe('audit()', () => {
        it('logs via singleton without throwing', () => {
            expect(() => {
                audit({ action: 'test', actor: 'user' });
            }).not.toThrow();
        });

        it('accepts optional target and details', () => {
            expect(() => {
                audit({
                    action: 'config-change',
                    actor: 'admin',
                    target: 'rate-limit',
                    details: { old: 100, new: 200 },
                });
            }).not.toThrow();
        });
    });

    describe('getAuditLog()', () => {
        it('returns recent events from singleton', () => {
            const events = getAuditLog(10);
            expect(Array.isArray(events)).toBe(true);
        });

        it('defaults to 100 limit', () => {
            const events = getAuditLog();
            expect(Array.isArray(events)).toBe(true);
        });
    });

    describe('readAuditLog()', () => {
        it('returns recent events (sync compat shim)', () => {
            const events = readAuditLog();
            expect(Array.isArray(events)).toBe(true);
        });

        it('ignores date parameter (sync fallback)', () => {
            const events = readAuditLog('2026-01-01');
            expect(Array.isArray(events)).toBe(true);
        });
    });

    describe('initAuditLogger()', () => {
        it('returns an AuditLogger instance', () => {
            const l = initAuditLogger('/tmp/init-test');
            expect(l).toBeInstanceOf(AuditLogger);
        });

        it('replaces the singleton', () => {
            initAuditLogger('/tmp/a');
            audit({ action: 'a', actor: 'x' });

            initAuditLogger('/tmp/b');
            // Should not crash — new singleton is independent
            const log = getAuditLog(10);
            expect(Array.isArray(log)).toBe(true);
        });
    });
});
