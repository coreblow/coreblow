/**
 * Contract Test: Channel Policy Engine
 *
 * Memverifikasi bahwa `applyChannelPolicy()` selalu return shape yang sama
 * dan behavioral contract-nya konsisten — tidak peduli implementasi internal.
 *
 * Contract:
 * 1. Selalu return object dengan semua required fields
 * 2. `allowed` selalu boolean
 * 3. `reason` selalu salah satu dari nilai yang didefinisikan
 * 4. `gating` selalu berisi 4 boolean fields
 * 5. `debounceMs` selalu non-negative number
 * 6. allow=false tidak pernah punya shouldDebounce=true
 */
import { describe, it, expect } from 'vitest';
import { applyChannelPolicy } from '../../src/channels/policy/channel-policy-engine.js';
import type { ChannelPolicyMessage, ChannelPolicyConfig } from '../../src/channels/policy/channel-policy-engine.js';

const VALID_REASONS = [
    'allowed',
    'wildcard',
    'allowlist_deny',
    'mention_required',
    'command_blocked',
] as const;

function makeMsg(overrides: Partial<ChannelPolicyMessage> = {}): ChannelPolicyMessage {
    return {
        senderId: 'user123',
        content: 'hello',
        isGroup: false,
        wasMentioned: false,
        canDetectMention: true,
        channelName: 'discord',
        ...overrides,
    };
}

describe('applyChannelPolicy — shape contract', () => {
    const configs: Array<[string, ChannelPolicyConfig]> = [
        ['empty config', {}],
        ['allowlist config', { allowFrom: ['user123'] }],
        ['wildcard allowFrom', { allowFrom: ['*'] }],
        ['deny all', { allowFrom: [] }],
        ['requireMention group', { requireMention: true }],
        ['debounce config', { debounce: { debounceMs: 300 } }],
    ];

    it.each(configs)('always returns required shape (%s)', (_, config) => {
        const result = applyChannelPolicy({ config, message: makeMsg() });

        // Shape contract
        expect(typeof result.allowed).toBe('boolean');
        expect(typeof result.reason).toBe('string');
        expect(typeof result.shouldDebounce).toBe('boolean');
        expect(typeof result.debounceMs).toBe('number');
        expect(typeof result.gating).toBe('object');

        // Gating shape contract
        expect(typeof result.gating.allowlistChecked).toBe('boolean');
        expect(typeof result.gating.mentionChecked).toBe('boolean');
        expect(typeof result.gating.commandChecked).toBe('boolean');
        expect(typeof result.gating.bypassedMentionViaCommand).toBe('boolean');

        // debounceMs invariant
        expect(result.debounceMs).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(result.debounceMs)).toBe(true);
    });

    it('reason is always one of the defined values', () => {
        const cases: Array<[ChannelPolicyConfig, ChannelPolicyMessage]> = [
            [{}, makeMsg()],
            [{ allowFrom: ['*'] }, makeMsg()],
            [{ allowFrom: [] }, makeMsg()],
            [{ requireMention: true }, makeMsg({ isGroup: true, wasMentioned: false })],
        ];

        for (const [config, message] of cases) {
            const result = applyChannelPolicy({ config, message });
            expect(VALID_REASONS).toContain(result.reason);
        }
    });

    it('allowed=false never has shouldDebounce=true', () => {
        const result = applyChannelPolicy({
            config: { allowFrom: [] },
            message: makeMsg(),
        });
        expect(result.allowed).toBe(false);
        expect(result.shouldDebounce).toBe(false);
    });

    it('shouldDebounce is false when debounceMs is 0', () => {
        const result = applyChannelPolicy({ config: {}, message: makeMsg() });
        expect(result.debounceMs).toBe(0);
        expect(result.shouldDebounce).toBe(false);
    });

    it('shouldDebounce is false for media messages even with debounce config', () => {
        const result = applyChannelPolicy({
            config: { debounce: { debounceMs: 300 } },
            message: makeMsg({ hasMedia: true }),
        });
        expect(result.shouldDebounce).toBe(false);
    });
});
