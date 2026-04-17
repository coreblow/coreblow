/**
 * Tests: Channel Policy Engine (Facade) — Integration Tests
 */
import { describe, it, expect } from 'vitest';
import { applyChannelPolicy } from '../../src/channels/policy/channel-policy-engine.js';
import type { ChannelPolicyConfig, ChannelPolicyMessage } from '../../src/channels/policy/channel-policy-engine.js';

function makeMsg(overrides: Partial<ChannelPolicyMessage> = {}): ChannelPolicyMessage {
    return {
        senderId: 'user123',
        content: 'hello bot',
        isGroup: false,
        wasMentioned: false,
        canDetectMention: true,
        channelName: 'discord',
        ...overrides,
    };
}

describe('applyChannelPolicy — allowlist', () => {
    it('allows when allowFrom not configured (open)', () => {
        const result = applyChannelPolicy({
            config: {},
            message: makeMsg(),
        });
        expect(result.allowed).toBe(true);
        expect(result.reason).toBe('allowed');
    });

    it('allows wildcard allowFrom', () => {
        const result = applyChannelPolicy({
            config: { allowFrom: ['*'] },
            message: makeMsg({ senderId: 'anyone' }),
        });
        expect(result.allowed).toBe(true);
        expect(result.reason).toBe('wildcard');
    });

    it('allows sender in allowFrom', () => {
        const result = applyChannelPolicy({
            config: { allowFrom: ['user123', 'admin'] },
            message: makeMsg({ senderId: 'user123' }),
        });
        expect(result.allowed).toBe(true);
    });

    it('denies sender not in allowFrom', () => {
        const result = applyChannelPolicy({
            config: { allowFrom: ['admin'] },
            message: makeMsg({ senderId: 'hacker' }),
        });
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('allowlist_deny');
    });

    it('uses groupAllowFrom for group messages', () => {
        const result = applyChannelPolicy({
            config: { allowFrom: ['dm-user'], groupAllowFrom: ['group-admin'] },
            message: makeMsg({ isGroup: true, senderId: 'group-admin' }),
        });
        expect(result.allowed).toBe(true);
    });

    it('denies when allowFrom is empty array (explicit empty)', () => {
        const result = applyChannelPolicy({
            config: { allowFrom: [] },
            message: makeMsg(),
        });
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('allowlist_deny');
    });
});

describe('applyChannelPolicy — mention gating', () => {
    it('blocks in group when requireMention=true and not mentioned', () => {
        const result = applyChannelPolicy({
            config: { requireMention: true },
            message: makeMsg({ isGroup: true, wasMentioned: false }),
        });
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('mention_required');
    });

    it('allows in group when mentioned', () => {
        const result = applyChannelPolicy({
            config: { requireMention: true },
            message: makeMsg({ isGroup: true, wasMentioned: true }),
        });
        expect(result.allowed).toBe(true);
    });

    it('allows in DM regardless of requireMention (canDetectMention bypass)', () => {
        const result = applyChannelPolicy({
            config: { requireMention: true },
            message: makeMsg({ isGroup: false, wasMentioned: false }),
        });
        expect(result.allowed).toBe(true);
    });

    it('allows when command bypasses mention requirement', () => {
        const result = applyChannelPolicy({
            config: { requireMention: true, allowTextCommands: true },
            message: makeMsg({
                isGroup: true,
                wasMentioned: false,
                hasControlCommand: true,
                canDetectMention: true,
            }),
        });
        // Command authorized (access groups off, mode=allow) → bypass mention
        expect(result.allowed).toBe(true);
        expect(result.gating.bypassedMentionViaCommand).toBe(true);
    });
});

describe('applyChannelPolicy — debounce', () => {
    it('shouldDebounce=false when no debounce config', () => {
        const result = applyChannelPolicy({
            config: {},
            message: makeMsg(),
        });
        expect(result.shouldDebounce).toBe(false);
        expect(result.debounceMs).toBe(0);
    });

    it('shouldDebounce=true when debounceMs > 0', () => {
        const result = applyChannelPolicy({
            config: { debounce: { debounceMs: 300 } },
            message: makeMsg({ channelName: 'telegram' }),
        });
        expect(result.shouldDebounce).toBe(true);
        expect(result.debounceMs).toBe(300);
    });

    it('shouldDebounce=false for media messages', () => {
        const result = applyChannelPolicy({
            config: { debounce: { debounceMs: 300 } },
            message: makeMsg({ hasMedia: true }),
        });
        expect(result.shouldDebounce).toBe(false);
    });

    it('uses per-channel debounce override', () => {
        const result = applyChannelPolicy({
            config: { debounce: { debounceMs: 100, byChannel: { discord: 500 } } },
            message: makeMsg({ channelName: 'discord' }),
        });
        expect(result.debounceMs).toBe(500);
        expect(result.shouldDebounce).toBe(true);
    });
});

describe('applyChannelPolicy — combined scenarios', () => {
    it('allowlist deny short-circuits before mention check', () => {
        const result = applyChannelPolicy({
            config: { allowFrom: ['admin'], requireMention: true },
            message: makeMsg({ senderId: 'unknown', isGroup: true, wasMentioned: true }),
        });
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('allowlist_deny');
        expect(result.gating.mentionChecked).toBe(false);
    });

    it('full allow: in allowFrom, mentioned, no command block', () => {
        const result = applyChannelPolicy({
            config: { allowFrom: ['user123'], requireMention: true },
            message: makeMsg({ senderId: 'user123', isGroup: true, wasMentioned: true }),
        });
        expect(result.allowed).toBe(true);
        expect(result.reason).toBe('allowed');
    });
});
