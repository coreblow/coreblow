/**
 * CoreBlow — Bash Tools Exec Approval Followup Tests (Inline)
 *
 * Tests buildExecApprovalFollowupPrompt logic inline to avoid
 * heavy import chain (callGatewayTool → markdown-it).
 */

import { describe, it, expect } from 'vitest';

// ── Inline replica of the pure function ────────────────────────────
function buildExecApprovalFollowupPrompt(resultText: string): string {
    return [
        "An async command the user already approved has completed.",
        "Do not run the command again.",
        "",
        "Exact completion details:",
        resultText.trim(),
        "",
        "Reply to the user in a helpful way.",
        "If it succeeded, share the relevant output.",
        "If it failed, explain what went wrong.",
    ].join("\n");
}

describe('buildExecApprovalFollowupPrompt', () => {
    it('builds prompt with result text', () => {
        const prompt = buildExecApprovalFollowupPrompt('Command completed successfully\nExit code: 0');
        expect(prompt).toContain('async command');
        expect(prompt).toContain('already approved');
        expect(prompt).toContain('Do not run the command again');
        expect(prompt).toContain('Command completed successfully');
        expect(prompt).toContain('Exit code: 0');
    });

    it('trims result text', () => {
        const prompt = buildExecApprovalFollowupPrompt('  output  \n  ');
        expect(prompt).toContain('output');
        // Should not have leading/trailing whitespace in the result section
        expect(prompt).toContain('Exact completion details:\noutput');
    });

    it('includes user reply instructions', () => {
        const prompt = buildExecApprovalFollowupPrompt('done');
        expect(prompt).toContain('Reply to the user');
        expect(prompt).toContain('succeeded');
        expect(prompt).toContain('failed');
    });

    it('handles multiline output', () => {
        const prompt = buildExecApprovalFollowupPrompt('line1\nline2\nline3');
        expect(prompt).toContain('line1\nline2\nline3');
    });

    it('handles empty result', () => {
        const prompt = buildExecApprovalFollowupPrompt('');
        expect(prompt).toContain('Exact completion details:');
    });
});
