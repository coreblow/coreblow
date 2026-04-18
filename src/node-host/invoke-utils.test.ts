// @ts-nocheck
import { describe, it, expect } from 'vitest';
import {
    parseWindowsCodePage,
    decodeCapturedOutputBuffer,
    sanitizeEnv,
    coerceNodeInvokePayload,
    buildNodeInvokeResultParams,
} from './invoke.js';
import {
    parseCronExpression,
    resolveMutableFileOperandSnapshotSync,
} from './invoke-system-run-plan.js';

describe('Node-Host Invoke Utilities — Phase 12', () => {

    // ─── parseWindowsCodePage ──────────────────────────────────

    describe('parseWindowsCodePage', () => {
        it('parses code page from chcp output', () => {
            expect(parseWindowsCodePage('Active code page: 65001')).toBe(65001);
        });

        it('parses 3-digit code page', () => {
            expect(parseWindowsCodePage('Code page: 936')).toBe(936);
        });

        it('returns null for empty string', () => {
            expect(parseWindowsCodePage('')).toBeNull();
        });

        it('returns null for no digits', () => {
            expect(parseWindowsCodePage('no code page here')).toBeNull();
        });
    });

    // ─── decodeCapturedOutputBuffer ────────────────────────────

    describe('decodeCapturedOutputBuffer', () => {
        it('decodes UTF-8 buffer on non-windows', () => {
            const buf = Buffer.from('Hello 世界');
            const result = decodeCapturedOutputBuffer({ buffer: buf, platform: 'darwin' });
            expect(result).toBe('Hello 世界');
        });

        it('falls back to UTF-8 on windows with null encoding', () => {
            const buf = Buffer.from('ASCII text');
            const result = decodeCapturedOutputBuffer({
                buffer: buf,
                platform: 'win32',
                windowsEncoding: null,
            });
            expect(result).toBe('ASCII text');
        });

        it('falls back to UTF-8 on windows with utf-8 encoding', () => {
            const buf = Buffer.from('Hello');
            const result = decodeCapturedOutputBuffer({
                buffer: buf,
                platform: 'win32',
                windowsEncoding: 'utf-8',
            });
            expect(result).toBe('Hello');
        });
    });

    // ─── sanitizeEnv ──────────────────────────────────────────

    describe('sanitizeEnv', () => {
        it('returns an object', () => {
            const env = sanitizeEnv();
            expect(typeof env).toBe('object');
        });

        it('preserves PATH', () => {
            const env = sanitizeEnv();
            expect(env.PATH || env.Path).toBeTruthy();
        });
    });

    // ─── coerceNodeInvokePayload ──────────────────────────────

    describe('coerceNodeInvokePayload', () => {
        it('coerces valid payload', () => {
            const result = coerceNodeInvokePayload({
                id: 'req-1',
                nodeId: 'node-1',
                command: 'system.run',
                paramsJSON: '{"command":["ls"]}',
            });
            expect(result).not.toBeNull();
            expect(result!.id).toBe('req-1');
            expect(result!.command).toBe('system.run');
        });

        it('rejects null', () => {
            expect(coerceNodeInvokePayload(null)).toBeNull();
        });

        it('rejects empty object', () => {
            expect(coerceNodeInvokePayload({})).toBeNull();
        });

        it('rejects missing required fields', () => {
            expect(coerceNodeInvokePayload({ id: 'x' })).toBeNull();
        });

        it('coerces params object to paramsJSON', () => {
            const result = coerceNodeInvokePayload({
                id: 'req-2',
                nodeId: 'n-2',
                command: 'system.which',
                params: { bins: ['node'] },
            });
            expect(result!.paramsJSON).toBe('{"bins":["node"]}');
        });

        it('handles optional fields', () => {
            const result = coerceNodeInvokePayload({
                id: 'req-3',
                nodeId: 'n-3',
                command: 'system.run',
                timeoutMs: 5000,
                idempotencyKey: 'key-1',
            });
            expect(result!.timeoutMs).toBe(5000);
            expect(result!.idempotencyKey).toBe('key-1');
        });
    });

    // ─── buildNodeInvokeResultParams ──────────────────────────

    describe('buildNodeInvokeResultParams', () => {
        const frame = { id: 'req-1', nodeId: 'node-1', command: 'system.run' };

        it('builds success result', () => {
            const result = buildNodeInvokeResultParams(frame, {
                ok: true,
                payloadJSON: '{"exitCode":0}',
            });
            expect(result.ok).toBe(true);
            expect(result.id).toBe('req-1');
            expect(result.payloadJSON).toBe('{"exitCode":0}');
        });

        it('builds error result', () => {
            const result = buildNodeInvokeResultParams(frame, {
                ok: false,
                error: { code: 'TIMEOUT', message: 'timed out' },
            });
            expect(result.ok).toBe(false);
            expect(result.error!.code).toBe('TIMEOUT');
        });

        it('includes payload when provided', () => {
            const result = buildNodeInvokeResultParams(frame, {
                ok: true,
                payload: { bins: { node: '/usr/bin/node' } },
            });
            expect(result.payload).toEqual({ bins: { node: '/usr/bin/node' } });
        });

        it('omits error when not provided', () => {
            const result = buildNodeInvokeResultParams(frame, { ok: true });
            expect(result.error).toBeUndefined();
        });
    });

    // ─── resolveMutableFileOperandSnapshotSync ────────────────

    describe('resolveMutableFileOperandSnapshotSync', () => {
        it('returns ok:true snapshot:null for non-interpreter command', () => {
            const result = resolveMutableFileOperandSnapshotSync({
                argv: ['ls', '-la'],
                cwd: '/tmp',
                shellCommand: null,
            });
            expect(result.ok).toBe(true);
            expect(result.snapshot).toBeNull();
        });
    });
});
