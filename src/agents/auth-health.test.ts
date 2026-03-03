import { describe, it, expect } from 'vitest';
import {
    buildAuthHealthSummary, formatRemainingShort, formatAuthHealthSummary,
    DEFAULT_OAUTH_WARN_MS, type AuthProfileStore,
} from './auth-health.js';

describe('Auth Health', () => {
    describe('formatRemainingShort', () => {
        it('unknown for undefined', () => expect(formatRemainingShort()).toBe('unknown'));
        it('0m for expired', () => expect(formatRemainingShort(-1000)).toBe('0m'));
        it('minutes', () => expect(formatRemainingShort(300_000)).toBe('5m'));
        it('hours', () => expect(formatRemainingShort(7_200_000)).toBe('2h'));
        it('days', () => expect(formatRemainingShort(172_800_000)).toBe('2d'));
        it('1m for under minute', () => expect(formatRemainingShort(30_000)).toBe('1m'));
    });

    describe('buildAuthHealthSummary', () => {
        it('empty store', () => {
            const store: AuthProfileStore = { profiles: {} };
            const summary = buildAuthHealthSummary({ store });
            expect(summary.profiles).toHaveLength(0);
            expect(summary.providers).toHaveLength(0);
        });

        it('static api key', () => {
            const store: AuthProfileStore = {
                profiles: { main: { provider: 'openai', type: 'api_key', label: 'Main' } },
            };
            const summary = buildAuthHealthSummary({ store });
            expect(summary.profiles).toHaveLength(1);
            expect(summary.profiles[0].status).toBe('static');
            expect(summary.providers[0].status).toBe('static');
        });

        it('expired token', () => {
            const store: AuthProfileStore = {
                profiles: { tok: { provider: 'anthropic', type: 'token', expires: Date.now() - 10_000 } },
            };
            const summary = buildAuthHealthSummary({ store });
            expect(summary.profiles[0].status).toBe('expired');
        });

        it('expiring token', () => {
            const store: AuthProfileStore = {
                profiles: { tok: { provider: 'google', type: 'token', expires: Date.now() + 3_600_000 } },
            };
            const summary = buildAuthHealthSummary({ store, warnAfterMs: DEFAULT_OAUTH_WARN_MS });
            expect(summary.profiles[0].status).toBe('expiring');
        });

        it('ok token', () => {
            const store: AuthProfileStore = {
                profiles: { tok: { provider: 'openai', type: 'token', expires: Date.now() + 100_000_000 } },
            };
            const summary = buildAuthHealthSummary({ store });
            expect(summary.profiles[0].status).toBe('ok');
        });

        it('oauth with refresh is ok even if expired', () => {
            const store: AuthProfileStore = {
                profiles: { oa: { provider: 'google', type: 'oauth', expires: Date.now() - 10_000, refresh: 'rt_abc' } },
            };
            const summary = buildAuthHealthSummary({ store });
            expect(summary.profiles[0].status).toBe('ok');
        });

        it('filters by provider', () => {
            const store: AuthProfileStore = {
                profiles: {
                    a: { provider: 'openai', type: 'api_key' },
                    b: { provider: 'anthropic', type: 'api_key' },
                },
            };
            const summary = buildAuthHealthSummary({ store, providers: ['openai'] });
            expect(summary.profiles).toHaveLength(1);
            expect(summary.profiles[0].provider).toBe('openai');
        });

        it('adds missing providers from filter', () => {
            const store: AuthProfileStore = { profiles: {} };
            const summary = buildAuthHealthSummary({ store, providers: ['deepseek'] });
            expect(summary.providers).toHaveLength(1);
            expect(summary.providers[0].status).toBe('missing');
        });

        it('provider aggregation — worst wins', () => {
            const store: AuthProfileStore = {
                profiles: {
                    ok: { provider: 'openai', type: 'token', expires: Date.now() + 100_000_000 },
                    bad: { provider: 'openai', type: 'token', expires: Date.now() - 10_000 },
                },
            };
            const summary = buildAuthHealthSummary({ store });
            expect(summary.providers[0].status).toBe('expired');
        });
    });

    describe('formatAuthHealthSummary', () => {
        it('empty', () => {
            const summary = buildAuthHealthSummary({ store: { profiles: {} } });
            expect(formatAuthHealthSummary(summary)).toContain('No auth profiles');
        });
        it('with profiles', () => {
            const store: AuthProfileStore = {
                profiles: { main: { provider: 'openai', type: 'api_key', label: 'Main' } },
            };
            const summary = buildAuthHealthSummary({ store });
            const text = formatAuthHealthSummary(summary);
            expect(text).toContain('openai');
            expect(text).toContain('static');
        });
    });
});
