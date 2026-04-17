/**
 * pairing/pairing-messages.test.ts — Pairing message formatting tests
 */
import { describe, it, expect } from 'vitest';
import { buildPairingReply, buildPairingSuccessReply, buildPairingRejectedReply, buildPairingExpiredReply, buildPairingAlreadyExistsReply } from './pairing-messages.js';

describe('Pairing Messages', () => {
    it('builds pairing reply with code', () => {
        const msg = buildPairingReply({ channel: 'discord', idLine: 'user#1234', code: 'ABCD1234' });
        expect(msg).toContain('ABCD1234');
        expect(msg).toContain('discord');
        expect(msg).toContain('user#1234');
        expect(msg).toContain('coreblow pair accept');
    });

    it('builds success reply', () => {
        const msg = buildPairingSuccessReply({ channel: 'telegram', senderId: '@user' });
        expect(msg).toContain('Paired');
        expect(msg).toContain('telegram');
        expect(msg).toContain('@user');
    });

    it('builds rejected reply', () => {
        expect(buildPairingRejectedReply()).toContain('Rejected');
    });

    it('builds expired reply', () => {
        expect(buildPairingExpiredReply()).toContain('Expired');
    });

    it('builds already exists reply', () => {
        expect(buildPairingAlreadyExistsReply()).toContain('already paired');
    });
});
