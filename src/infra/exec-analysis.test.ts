// @ts-nocheck
import { describe, it, expect } from 'vitest';
import {
    isWindowsPlatform,
    analyzeShellCommand,
    splitCommandChain,
    splitCommandChainWithOperators,
    buildSafeShellCommand,
    resolvePlannedSegmentArgv,
} from './exec-approvals-analysis.js';
import {
    normalizeSafeBins,
    resolveSafeBins,
} from './exec-approvals-allowlist.js';

describe('Exec Analysis & Allowlist — Phase 15', () => {

    // ─── isWindowsPlatform ─────────────────────────────────────

    describe('isWindowsPlatform', () => {
        it('win32 is windows', () => {
            expect(isWindowsPlatform('win32')).toBe(true);
        });

        it('windows is windows', () => {
            expect(isWindowsPlatform('windows')).toBe(true);
        });

        it('linux is not windows', () => {
            expect(isWindowsPlatform('linux')).toBe(false);
        });

        it('darwin is not windows', () => {
            expect(isWindowsPlatform('darwin')).toBe(false);
        });

        it('null defaults to not windows', () => {
            expect(isWindowsPlatform(null)).toBe(false);
        });
    });

    // ─── splitCommandChain ─────────────────────────────────────

    describe('splitCommandChain', () => {
        it('returns null for simple command', () => {
            expect(splitCommandChain('ls -la')).toBeNull();
        });

        it('splits && chain', () => {
            const parts = splitCommandChain('npm test && npm build');
            expect(parts).toEqual(['npm test', 'npm build']);
        });

        it('splits || chain', () => {
            const parts = splitCommandChain('test -f foo || echo missing');
            expect(parts).toEqual(['test -f foo', 'echo missing']);
        });

        it('splits ; chain', () => {
            const parts = splitCommandChain('echo a; echo b');
            expect(parts).toEqual(['echo a', 'echo b']);
        });

        it('preserves quoted strings', () => {
            const parts = splitCommandChain('echo "hello && world" && echo done');
            expect(parts).toEqual(['echo "hello && world"', 'echo done']);
        });
    });

    // ─── splitCommandChainWithOperators ─────────────────────────

    describe('splitCommandChainWithOperators', () => {
        it('returns null for no chain', () => {
            expect(splitCommandChainWithOperators('echo hello')).toBeNull();
        });

        it('returns parts with operators', () => {
            const parts = splitCommandChainWithOperators('a && b || c');
            expect(parts).toHaveLength(3);
            expect(parts![0].part).toBe('a');
            expect(parts![0].opToNext).toBe('&&');
            expect(parts![1].part).toBe('b');
            expect(parts![1].opToNext).toBe('||');
            expect(parts![2].opToNext).toBeNull();
        });
    });

    // ─── analyzeShellCommand ───────────────────────────────────

    describe('analyzeShellCommand', () => {
        it('analyzes simple command', () => {
            const result = analyzeShellCommand({ command: 'ls -la', platform: 'linux' });
            expect(result.ok).toBe(true);
            expect(result.segments).toHaveLength(1);
            expect(result.segments[0].argv).toEqual(['ls', '-la']);
        });

        it('analyzes pipe command', () => {
            const result = analyzeShellCommand({ command: 'cat foo | grep bar', platform: 'linux' });
            expect(result.ok).toBe(true);
            expect(result.segments).toHaveLength(2);
        });

        it('rejects empty command', () => {
            const result = analyzeShellCommand({ command: '', platform: 'linux' });
            expect(result.ok).toBe(false);
        });

        it('rejects command substitution', () => {
            const result = analyzeShellCommand({ command: 'echo $(whoami)', platform: 'linux' });
            expect(result.ok).toBe(false);
        });

        it('rejects backtick substitution', () => {
            const result = analyzeShellCommand({ command: 'echo `whoami`', platform: 'linux' });
            expect(result.ok).toBe(false);
        });

        it('rejects redirect', () => {
            const result = analyzeShellCommand({ command: 'echo hello > file', platform: 'linux' });
            expect(result.ok).toBe(false);
        });

        it('analyzes chain commands', () => {
            const result = analyzeShellCommand({ command: 'echo a && echo b', platform: 'linux' });
            expect(result.ok).toBe(true);
            expect(result.segments).toHaveLength(2);
            expect(result.chains).toHaveLength(2);
        });
    });

    // ─── buildSafeShellCommand ─────────────────────────────────

    describe('buildSafeShellCommand', () => {
        it('quotes simple command', () => {
            const result = buildSafeShellCommand({ command: 'ls -la', platform: 'linux' });
            expect(result.ok).toBe(true);
            expect(result.command).toContain("'ls'");
            expect(result.command).toContain("'-la'");
        });

        it('rejects on windows', () => {
            const result = buildSafeShellCommand({ command: 'dir', platform: 'win32' });
            expect(result.ok).toBe(false);
        });

        it('rejects empty command', () => {
            const result = buildSafeShellCommand({ command: '', platform: 'linux' });
            expect(result.ok).toBe(false);
        });
    });

    // ─── resolvePlannedSegmentArgv ──────────────────────────────

    describe('resolvePlannedSegmentArgv', () => {
        it('returns argv for valid segment', () => {
            const argv = resolvePlannedSegmentArgv({
                raw: 'ls -la',
                argv: ['ls', '-la'],
                resolution: null,
            });
            expect(argv).toEqual(['ls', '-la']);
        });

        it('returns null for policy-blocked', () => {
            const argv = resolvePlannedSegmentArgv({
                raw: 'rm -rf /',
                argv: ['rm', '-rf', '/'],
                resolution: { policyBlocked: true },
            });
            expect(argv).toBeNull();
        });
    });

    // ─── normalizeSafeBins ─────────────────────────────────────

    describe('normalizeSafeBins', () => {
        it('normalizes entries', () => {
            const bins = normalizeSafeBins(['LS', ' cat ', 'ECHO']);
            expect(bins.has('ls')).toBe(true);
            expect(bins.has('cat')).toBe(true);
            expect(bins.has('echo')).toBe(true);
        });

        it('filters empty entries', () => {
            const bins = normalizeSafeBins(['ls', '', '  ']);
            expect(bins.size).toBe(1);
        });

        it('returns empty for undefined', () => {
            expect(normalizeSafeBins(undefined as any)).toEqual(new Set());
        });
    });

    // ─── resolveSafeBins ───────────────────────────────────────

    describe('resolveSafeBins', () => {
        it('returns defaults when undefined', () => {
            const bins = resolveSafeBins(undefined);
            expect(bins.size).toBeGreaterThan(0);
        });

        it('returns empty set for null', () => {
            const bins = resolveSafeBins(null);
            expect(bins.size).toBe(0);
        });

        it('returns custom entries', () => {
            const bins = resolveSafeBins(['mybin']);
            expect(bins.has('mybin')).toBe(true);
            expect(bins.size).toBe(1);
        });
    });
});
