/**
 * Tests: Channel Policy — Mention Gating + Command Gating
 */
import { describe, it, expect } from 'vitest';
import {
    resolveMentionGating,
    resolveMentionGatingWithBypass,
} from '../../src/channels/policy/mention-gating.js';
import {
    resolveCommandAuthorized,
    resolveControlCommandGate,
    resolveDualCommandGate,
} from '../../src/channels/policy/command-gating.js';

// ─── mention-gating.ts ────────────────────────────────────────────────────────

describe('resolveMentionGating', () => {
    it('skips when requireMention=true, not mentioned', () => {
        const result = resolveMentionGating({
            requireMention: true,
            canDetectMention: true,
            wasMentioned: false,
        });
        expect(result.shouldSkip).toBe(true);
        expect(result.effectiveWasMentioned).toBe(false);
    });

    it('allows when requireMention=false (DM)', () => {
        const result = resolveMentionGating({
            requireMention: false,
            canDetectMention: true,
            wasMentioned: false,
        });
        expect(result.shouldSkip).toBe(false);
    });

    it('allows when mentioned', () => {
        const result = resolveMentionGating({
            requireMention: true,
            canDetectMention: true,
            wasMentioned: true,
        });
        expect(result.shouldSkip).toBe(false);
        expect(result.effectiveWasMentioned).toBe(true);
    });

    it('allows via implicitMention (reply to bot)', () => {
        const result = resolveMentionGating({
            requireMention: true,
            canDetectMention: true,
            wasMentioned: false,
            implicitMention: true,
        });
        expect(result.shouldSkip).toBe(false);
        expect(result.effectiveWasMentioned).toBe(true);
    });

    it('allows via shouldBypassMention', () => {
        const result = resolveMentionGating({
            requireMention: true,
            canDetectMention: true,
            wasMentioned: false,
            shouldBypassMention: true,
        });
        expect(result.shouldSkip).toBe(false);
    });

    it('never blocks when canDetectMention=false', () => {
        const result = resolveMentionGating({
            requireMention: true,
            canDetectMention: false,
            wasMentioned: false,
        });
        expect(result.shouldSkip).toBe(false);
    });
});

describe('resolveMentionGatingWithBypass', () => {
    it('bypasses mention via command in group chat', () => {
        const result = resolveMentionGatingWithBypass({
            isGroup: true,
            requireMention: true,
            canDetectMention: true,
            wasMentioned: false,
            hasAnyMention: false,
            allowTextCommands: true,
            hasControlCommand: true,
            commandAuthorized: true,
        });
        expect(result.shouldBypassMention).toBe(true);
        expect(result.shouldSkip).toBe(false);
    });

    it('does NOT bypass in DM (isGroup=false)', () => {
        const result = resolveMentionGatingWithBypass({
            isGroup: false,
            requireMention: true,
            canDetectMention: true,
            wasMentioned: false,
            allowTextCommands: true,
            hasControlCommand: true,
            commandAuthorized: true,
        });
        expect(result.shouldBypassMention).toBe(false);
    });

    it('does NOT bypass if command not authorized', () => {
        const result = resolveMentionGatingWithBypass({
            isGroup: true,
            requireMention: true,
            canDetectMention: true,
            wasMentioned: false,
            allowTextCommands: true,
            hasControlCommand: true,
            commandAuthorized: false,
        });
        expect(result.shouldBypassMention).toBe(false);
        expect(result.shouldSkip).toBe(true);
    });

    it('does NOT bypass if hasAnyMention=true (someone else was mentioned)', () => {
        const result = resolveMentionGatingWithBypass({
            isGroup: true,
            requireMention: true,
            canDetectMention: true,
            wasMentioned: false,
            hasAnyMention: true,
            allowTextCommands: true,
            hasControlCommand: true,
            commandAuthorized: true,
        });
        expect(result.shouldBypassMention).toBe(false);
    });
});

// ─── command-gating.ts ────────────────────────────────────────────────────────

describe('resolveCommandAuthorized', () => {
    it('returns true when access groups off and mode=allow', () => {
        expect(resolveCommandAuthorized({
            useAccessGroups: false,
            authorizers: [],
            modeWhenOff: 'allow',
        })).toBe(true);
    });

    it('returns false when access groups off and mode=deny', () => {
        expect(resolveCommandAuthorized({
            useAccessGroups: false,
            authorizers: [],
            modeWhenOff: 'deny',
        })).toBe(false);
    });

    it('returns true via access group when configured+allowed', () => {
        expect(resolveCommandAuthorized({
            useAccessGroups: true,
            authorizers: [{ configured: true, allowed: true }],
        })).toBe(true);
    });

    it('returns false via access group when not allowed', () => {
        expect(resolveCommandAuthorized({
            useAccessGroups: true,
            authorizers: [{ configured: true, allowed: false }],
        })).toBe(false);
    });

    it('allows any authorized in multi-authorizer setup', () => {
        expect(resolveCommandAuthorized({
            useAccessGroups: true,
            authorizers: [
                { configured: true, allowed: false },
                { configured: true, allowed: true },
            ],
        })).toBe(true);
    });
});

describe('resolveControlCommandGate', () => {
    it('blocks unauthorized command', () => {
        const result = resolveControlCommandGate({
            useAccessGroups: true,
            authorizers: [{ configured: true, allowed: false }],
            allowTextCommands: true,
            hasControlCommand: true,
        });
        expect(result.shouldBlock).toBe(true);
        expect(result.commandAuthorized).toBe(false);
    });

    it('does not block regular message (no command)', () => {
        const result = resolveControlCommandGate({
            useAccessGroups: true,
            authorizers: [{ configured: true, allowed: false }],
            allowTextCommands: true,
            hasControlCommand: false,
        });
        expect(result.shouldBlock).toBe(false);
    });

    it('does not block when allowTextCommands=false', () => {
        const result = resolveControlCommandGate({
            useAccessGroups: false,
            authorizers: [],
            allowTextCommands: false,
            hasControlCommand: true,
        });
        expect(result.shouldBlock).toBe(false);
    });
});

describe('resolveDualCommandGate', () => {
    it('allows when primary authorized', () => {
        const result = resolveDualCommandGate({
            useAccessGroups: true,
            primaryConfigured: true, primaryAllowed: true,
            secondaryConfigured: false, secondaryAllowed: false,
            hasControlCommand: true,
        });
        expect(result.commandAuthorized).toBe(true);
        expect(result.shouldBlock).toBe(false);
    });

    it('allows when secondary authorized', () => {
        const result = resolveDualCommandGate({
            useAccessGroups: true,
            primaryConfigured: true, primaryAllowed: false,
            secondaryConfigured: true, secondaryAllowed: true,
            hasControlCommand: true,
        });
        expect(result.commandAuthorized).toBe(true);
    });

    it('blocks when neither authorized', () => {
        const result = resolveDualCommandGate({
            useAccessGroups: true,
            primaryConfigured: true, primaryAllowed: false,
            secondaryConfigured: true, secondaryAllowed: false,
            hasControlCommand: true,
        });
        expect(result.shouldBlock).toBe(true);
    });
});
