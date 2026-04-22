import { describe, it, expect } from 'vitest';
import { resolvePairingMode, requiresPairing, canBypassPairing } from './pairing-policy.js';

describe('Pairing Policy', () => {
    describe('resolvePairingMode', () => {
        it('defaults to off', () => expect(resolvePairingMode()).toBe('off'));
        it('reads from config', () => expect(resolvePairingMode({ security: { pairingMode: 'dm-only' } })).toBe('dm-only'));
        it('ignores invalid', () => expect(resolvePairingMode({ security: { pairingMode: 'invalid' } })).toBe('off'));
    });

    describe('requiresPairing', () => {
        it('not required when off', () => {
            expect(requiresPairing({ mode: 'off', isDirectMessage: true, isPaired: false, channel: 'discord' }).requiresPairing).toBe(false);
        });

        it('not required when paired', () => {
            expect(requiresPairing({ mode: 'all', isDirectMessage: true, isPaired: true, channel: 'discord' }).requiresPairing).toBe(false);
        });

        it('required for DM in dm-only mode', () => {
            const result = requiresPairing({ mode: 'dm-only', isDirectMessage: true, isPaired: false, channel: 'discord' });
            expect(result.requiresPairing).toBe(true);
        });

        it('not required for group in dm-only mode', () => {
            expect(requiresPairing({ mode: 'dm-only', isDirectMessage: false, isPaired: false, channel: 'discord' }).requiresPairing).toBe(false);
        });

        it('required for all in all mode', () => {
            expect(requiresPairing({ mode: 'all', isDirectMessage: false, isPaired: false, channel: 'discord' }).requiresPairing).toBe(true);
        });
    });

    describe('canBypassPairing', () => {
        it('admin bypass', () => {
            expect(canBypassPairing({ senderId: 'admin1', adminIds: ['admin1'] })).toBe(true);
        });

        it('wildcard pattern', () => {
            expect(canBypassPairing({ senderId: 'anyone', allowPatterns: ['*'] })).toBe(true);
        });

        it('prefix pattern', () => {
            expect(canBypassPairing({ senderId: 'bot-123', allowPatterns: ['bot-*'] })).toBe(true);
        });

        it('no bypass', () => {
            expect(canBypassPairing({ senderId: 'user1', adminIds: ['admin1'] })).toBe(false);
        });
    });
});
