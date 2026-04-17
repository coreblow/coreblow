// @ts-nocheck
import { describe, it, expect } from 'vitest';
import {
    normalizeExecHost,
    normalizeExecSecurity,
    normalizeExecAsk,
    normalizeExecApprovals,
    resolveExecApprovalsFromFile,
    requiresExecApproval,
    minSecurity,
    maxAsk,
    mergeExecApprovalsSocketDefaults,
    DEFAULT_EXEC_APPROVAL_TIMEOUT_MS,
} from './exec-approvals.js';

describe('Exec Approvals — Phase 15', () => {

    // ─── normalizeExecHost ─────────────────────────────────────

    describe('normalizeExecHost', () => {
        it('normalizes valid hosts', () => {
            expect(normalizeExecHost('sandbox')).toBe('sandbox');
            expect(normalizeExecHost('gateway')).toBe('gateway');
            expect(normalizeExecHost('node')).toBe('node');
        });

        it('normalizes case-insensitive', () => {
            expect(normalizeExecHost('SANDBOX')).toBe('sandbox');
            expect(normalizeExecHost(' Node ')).toBe('node');
        });

        it('returns null for invalid', () => {
            expect(normalizeExecHost('invalid')).toBeNull();
            expect(normalizeExecHost(undefined)).toBeNull();
            expect(normalizeExecHost(null)).toBeNull();
            expect(normalizeExecHost('')).toBeNull();
        });
    });

    // ─── normalizeExecSecurity ─────────────────────────────────

    describe('normalizeExecSecurity', () => {
        it('normalizes valid values', () => {
            expect(normalizeExecSecurity('deny')).toBe('deny');
            expect(normalizeExecSecurity('allowlist')).toBe('allowlist');
            expect(normalizeExecSecurity('full')).toBe('full');
        });

        it('case-insensitive', () => {
            expect(normalizeExecSecurity('DENY')).toBe('deny');
        });

        it('returns null for invalid', () => {
            expect(normalizeExecSecurity('partial')).toBeNull();
            expect(normalizeExecSecurity(undefined)).toBeNull();
        });
    });

    // ─── normalizeExecAsk ──────────────────────────────────────

    describe('normalizeExecAsk', () => {
        it('normalizes valid values', () => {
            expect(normalizeExecAsk('off')).toBe('off');
            expect(normalizeExecAsk('on-miss')).toBe('on-miss');
            expect(normalizeExecAsk('always')).toBe('always');
        });

        it('returns null for invalid', () => {
            expect(normalizeExecAsk('never')).toBeNull();
            expect(normalizeExecAsk(undefined)).toBeNull();
        });
    });

    // ─── DEFAULT_EXEC_APPROVAL_TIMEOUT_MS ──────────────────────

    it('default timeout is 120 seconds', () => {
        expect(DEFAULT_EXEC_APPROVAL_TIMEOUT_MS).toBe(120_000);
    });

    // ─── normalizeExecApprovals ────────────────────────────────

    describe('normalizeExecApprovals', () => {
        it('normalizes empty file', () => {
            const result = normalizeExecApprovals({ version: 1, agents: {} });
            expect(result.version).toBe(1);
            expect(result.agents).toEqual({});
        });

        it('normalizes file with defaults', () => {
            const result = normalizeExecApprovals({
                version: 1,
                defaults: { security: 'full', ask: 'always' },
                agents: {},
            });
            expect(result.defaults!.security).toBe('full');
            expect(result.defaults!.ask).toBe('always');
        });

        it('normalizes socket path', () => {
            const result = normalizeExecApprovals({
                version: 1,
                socket: { path: '  /tmp/test.sock  ', token: '  abc  ' },
                agents: {},
            });
            expect(result.socket!.path).toBe('/tmp/test.sock');
            expect(result.socket!.token).toBe('abc');
        });

        it('coerces string allowlist entries', () => {
            const result = normalizeExecApprovals({
                version: 1,
                agents: {
                    'coreblow-agent': {
                        allowlist: ['ls', 'cat', 'echo'] as any,
                    },
                },
            });
            const entries = result.agents!['coreblow-agent'].allowlist!;
            expect(entries.every(e => typeof e.pattern === 'string')).toBe(true);
            expect(entries.map(e => e.pattern)).toEqual(['ls', 'cat', 'echo']);
        });
    });

    // ─── resolveExecApprovalsFromFile ──────────────────────────

    describe('resolveExecApprovalsFromFile', () => {
        it('resolves defaults', () => {
            const resolved = resolveExecApprovalsFromFile({
                file: { version: 1, agents: {} },
            });
            expect(resolved.defaults.security).toBe('deny');
            expect(resolved.defaults.ask).toBe('on-miss');
            expect(resolved.defaults.askFallback).toBe('deny');
            expect(resolved.defaults.autoAllowSkills).toBe(false);
        });

        it('applies overrides', () => {
            const resolved = resolveExecApprovalsFromFile({
                file: { version: 1, agents: {} },
                overrides: { security: 'full', ask: 'always' },
            });
            expect(resolved.defaults.security).toBe('full');
            expect(resolved.defaults.ask).toBe('always');
        });

        it('merges wildcard and agent allowlists', () => {
            const resolved = resolveExecApprovalsFromFile({
                file: {
                    version: 1,
                    agents: {
                        '*': { allowlist: [{ pattern: 'ls' }] },
                        'test-agent': { allowlist: [{ pattern: 'cat' }] },
                    },
                },
                agentId: 'test-agent',
            });
            expect(resolved.allowlist).toHaveLength(2);
            expect(resolved.allowlist.map(e => e.pattern)).toContain('ls');
            expect(resolved.allowlist.map(e => e.pattern)).toContain('cat');
        });

        it('falls back to empty allowlist', () => {
            const resolved = resolveExecApprovalsFromFile({
                file: { version: 1, agents: {} },
                agentId: 'nonexistent',
            });
            expect(resolved.allowlist).toEqual([]);
        });
    });

    // ─── requiresExecApproval ──────────────────────────────────

    describe('requiresExecApproval', () => {
        it('always requires approval when ask=always', () => {
            expect(requiresExecApproval({
                ask: 'always', security: 'full', analysisOk: true, allowlistSatisfied: true,
            })).toBe(true);
        });

        it('requires approval on miss when allowlist not satisfied', () => {
            expect(requiresExecApproval({
                ask: 'on-miss', security: 'allowlist', analysisOk: true, allowlistSatisfied: false,
            })).toBe(true);
        });

        it('does not require approval when allowlist satisfied', () => {
            expect(requiresExecApproval({
                ask: 'on-miss', security: 'allowlist', analysisOk: true, allowlistSatisfied: true,
            })).toBe(false);
        });

        it('does not require approval when ask=off', () => {
            expect(requiresExecApproval({
                ask: 'off', security: 'allowlist', analysisOk: false, allowlistSatisfied: false,
            })).toBe(false);
        });

        it('requires approval on miss when analysis not ok', () => {
            expect(requiresExecApproval({
                ask: 'on-miss', security: 'allowlist', analysisOk: false, allowlistSatisfied: false,
            })).toBe(true);
        });
    });

    // ─── minSecurity / maxAsk ──────────────────────────────────

    describe('minSecurity', () => {
        it('deny < allowlist < full', () => {
            expect(minSecurity('deny', 'full')).toBe('deny');
            expect(minSecurity('full', 'deny')).toBe('deny');
            expect(minSecurity('allowlist', 'full')).toBe('allowlist');
        });

        it('same value returns same', () => {
            expect(minSecurity('full', 'full')).toBe('full');
        });
    });

    describe('maxAsk', () => {
        it('off < on-miss < always', () => {
            expect(maxAsk('off', 'always')).toBe('always');
            expect(maxAsk('always', 'off')).toBe('always');
            expect(maxAsk('on-miss', 'always')).toBe('always');
        });

        it('same value returns same', () => {
            expect(maxAsk('on-miss', 'on-miss')).toBe('on-miss');
        });
    });

    // ─── mergeExecApprovalsSocketDefaults ──────────────────────

    describe('mergeExecApprovalsSocketDefaults', () => {
        it('preserves normalized socket path', () => {
            const result = mergeExecApprovalsSocketDefaults({
                normalized: {
                    version: 1,
                    socket: { path: '/custom.sock', token: 'tok' },
                    agents: {},
                },
            });
            expect(result.socket!.path).toBe('/custom.sock');
            expect(result.socket!.token).toBe('tok');
        });

        it('falls back to current socket when normalized empty', () => {
            const result = mergeExecApprovalsSocketDefaults({
                normalized: { version: 1, agents: {} },
                current: { version: 1, socket: { path: '/prev.sock', token: 'prev' }, agents: {} },
            });
            expect(result.socket!.path).toBe('/prev.sock');
            expect(result.socket!.token).toBe('prev');
        });
    });
});
