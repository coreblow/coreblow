/**
 * cli/channel-auth.test.ts — Channel auth tests
 */
import { describe, it, expect } from 'vitest';
import { getChannelAuthFields, isChannelAuthConfigured, getMissingAuthFields, formatChannelAuthStatus } from './channel-auth.js';

describe('Channel Auth', () => {
    describe('getChannelAuthFields', () => {
        it('returns discord fields', () => {
            const fields = getChannelAuthFields('discord');
            expect(fields.length).toBeGreaterThan(0);
            expect(fields[0].name).toBe('token');
            expect(fields[0].sensitive).toBe(true);
        });

        it('returns telegram fields', () => {
            const fields = getChannelAuthFields('telegram');
            expect(fields).toHaveLength(1);
        });

        it('returns slack fields', () => {
            const fields = getChannelAuthFields('slack');
            expect(fields.length).toBeGreaterThanOrEqual(2);
        });

        it('returns empty for unknown', () => {
            expect(getChannelAuthFields('unknown')).toEqual([]);
        });
    });

    describe('isChannelAuthConfigured', () => {
        it('returns true when all required env vars set', () => {
            expect(isChannelAuthConfigured('discord', { DISCORD_TOKEN: 'test' })).toBe(true);
        });

        it('returns false when missing', () => {
            expect(isChannelAuthConfigured('discord', {})).toBe(false);
        });
    });

    describe('getMissingAuthFields', () => {
        it('returns missing fields', () => {
            const missing = getMissingAuthFields('discord', {});
            expect(missing.length).toBeGreaterThan(0);
            expect(missing[0].envVar).toBe('DISCORD_TOKEN');
        });

        it('returns empty when all set', () => {
            const missing = getMissingAuthFields('discord', { DISCORD_TOKEN: 'test' });
            expect(missing).toHaveLength(0);
        });
    });

    describe('formatChannelAuthStatus', () => {
        it('shows status', () => {
            const result = formatChannelAuthStatus({ DISCORD_TOKEN: 'tok' });
            expect(result).toContain('discord');
            expect(result).toContain('✅');
        });
    });
});
