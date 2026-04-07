import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    resolveExecApprovalDecision,
    formatSystemRunAllowlistMissMessage,
    evaluateSystemRunPolicy,
    type ExecApprovalDecision,
} from './exec-policy.js';
import { withTimeout } from './with-timeout.js';
import { applyOutputTruncation } from './invoke-system-run-allowlist.js';
import type { RunResult } from './invoke-types.js';

// Mock the infra dependency that exec-policy needs
vi.mock('../infra/exec-approvals.js', () => ({
    requiresExecApproval: vi.fn((params: any) => {
        // If ask=always, always require approval
        if (params.ask === 'always') return true;
        // If ask=on-miss and not on allowlist, require approval
        if (params.ask === 'on-miss' && !params.allowlistSatisfied) return true;
        return false;
    }),
}));

describe('Node Host Module', () => {
    describe('exec-policy.ts', () => {
        describe('resolveExecApprovalDecision', () => {
            it('returns allow-once for valid value', () => {
                expect(resolveExecApprovalDecision('allow-once')).toBe('allow-once');
            });

            it('returns allow-always for valid value', () => {
                expect(resolveExecApprovalDecision('allow-always')).toBe('allow-always');
            });

            it('returns null for invalid values', () => {
                expect(resolveExecApprovalDecision('reject')).toBeNull();
                expect(resolveExecApprovalDecision(undefined)).toBeNull();
                expect(resolveExecApprovalDecision(42)).toBeNull();
                expect(resolveExecApprovalDecision(null)).toBeNull();
            });
        });

        describe('formatSystemRunAllowlistMissMessage', () => {
            it('returns Windows-specific message for Windows shell wrapper', () => {
                const msg = formatSystemRunAllowlistMissMessage({ windowsShellWrapperBlocked: true });
                expect(msg).toContain('Windows shell wrappers');
                expect(msg).toContain('cmd.exe');
            });

            it('returns Unix-specific message for shell wrapper', () => {
                const msg = formatSystemRunAllowlistMissMessage({ shellWrapperBlocked: true });
                expect(msg).toContain('sh/bash/zsh');
            });

            it('returns generic message without params', () => {
                expect(formatSystemRunAllowlistMissMessage()).toBe('SYSTEM_RUN_DENIED: allowlist miss');
                expect(formatSystemRunAllowlistMissMessage({})).toBe('SYSTEM_RUN_DENIED: allowlist miss');
            });
        });

        describe('evaluateSystemRunPolicy', () => {
            const baseParams = {
                security: 'allowlist' as const,
                ask: 'never' as any,
                analysisOk: true,
                allowlistSatisfied: true,
                approvalDecision: null as ExecApprovalDecision,
                isWindows: false,
                cmdInvocation: false,
                shellWrapperInvocation: false,
            };

            it('denies when security=deny', () => {
                const result = evaluateSystemRunPolicy({ ...baseParams, security: 'deny' as any });
                expect(result.allowed).toBe(false);
                if (!result.allowed) {
                    expect(result.eventReason).toBe('security=deny');
                    expect(result.errorMessage).toContain('DISABLED');
                }
            });

            it('allows when allowlist is satisfied and analysis ok', () => {
                const result = evaluateSystemRunPolicy(baseParams);
                expect(result.allowed).toBe(true);
                expect(result.allowlistSatisfied).toBe(true);
                expect(result.analysisOk).toBe(true);
            });

            it('blocks shell wrappers under allowlist security', () => {
                const result = evaluateSystemRunPolicy({
                    ...baseParams,
                    shellWrapperInvocation: true,
                });
                expect(result.shellWrapperBlocked).toBe(true);
                expect(result.allowed).toBe(false);
            });

            it('allows with approval decision even if allowlist misses', () => {
                const result = evaluateSystemRunPolicy({
                    ...baseParams,
                    allowlistSatisfied: false,
                    approvalDecision: 'allow-once',
                });
                expect(result.allowed).toBe(true);
                expect(result.approvedByAsk).toBe(true);
            });
        });
    });

    describe('with-timeout.ts', () => {
        it('completes fast work without timeout', async () => {
            const result = await withTimeout(async () => 'done', 5000, 'test');
            expect(result).toBe('done');
        });

        it('runs without timeout when timeoutMs is undefined', async () => {
            const result = await withTimeout(async () => 42, undefined, 'no-timeout');
            expect(result).toBe(42);
        });

        it('times out slow work', async () => {
            await expect(
                withTimeout(
                    () => new Promise(resolve => setTimeout(resolve, 5000)),
                    50,
                    'slow-op',
                ),
            ).rejects.toThrow('slow-op timed out');
        });

        it('passes abort signal to work function', async () => {
            let receivedSignal: AbortSignal | undefined;
            await withTimeout(async (signal) => {
                receivedSignal = signal;
                return 'ok';
            }, 5000);
            expect(receivedSignal).toBeInstanceOf(AbortSignal);
            expect(receivedSignal!.aborted).toBe(false);
        });
    });

    describe('invoke-system-run-allowlist.ts: applyOutputTruncation', () => {
        it('does nothing when not truncated', () => {
            const result: RunResult = {
                stdout: 'output', stderr: '', exitCode: 0,
                timedOut: false, success: true, truncated: false,
            };
            applyOutputTruncation(result);
            expect(result.stdout).toBe('output');
        });

        it('appends to stderr when truncated and stderr has content', () => {
            const result: RunResult = {
                stdout: 'out', stderr: 'err content', exitCode: 0,
                timedOut: false, success: true, truncated: true,
            };
            applyOutputTruncation(result);
            expect(result.stderr).toContain('(truncated)');
            expect(result.stdout).toBe('out'); // untouched
        });

        it('appends to stdout when truncated and stderr is empty', () => {
            const result: RunResult = {
                stdout: 'output here', stderr: '', exitCode: 0,
                timedOut: false, success: true, truncated: true,
            };
            applyOutputTruncation(result);
            expect(result.stdout).toContain('(truncated)');
        });
    });
});
