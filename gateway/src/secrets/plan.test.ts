/**
 * secrets/plan.test.ts — Resolution plan builder tests
 */
import { describe, it, expect } from 'vitest';
import { collectSecretRefs, groupRefsByProvider, buildResolutionPlanSummary } from './plan.js';

describe('Secret Plan Builder', () => {
    it('collects secret refs from config', () => {
        const config = {
            channels: { discord: { token: 'secret:env:default:DISCORD_TOKEN' } },
            models: { openai: { apiKey: 'secret:env:default:OPENAI_KEY' } },
        };
        const refs = collectSecretRefs(config);
        expect(refs).toHaveLength(2);
        expect(refs[0].source).toBe('env');
        expect(refs[0].provider).toBe('default');
        expect(refs[0].id).toBe('DISCORD_TOKEN');
    });

    it('deduplicates identical refs', () => {
        const config = {
            a: 'secret:env:default:SAME_KEY',
            b: 'secret:env:default:SAME_KEY',
        };
        const refs = collectSecretRefs(config);
        expect(refs).toHaveLength(1);
    });

    it('handles nested arrays', () => {
        const config = { list: ['secret:env:default:A', 'plain', 'secret:file:vault:B'] };
        const refs = collectSecretRefs(config);
        expect(refs).toHaveLength(2);
    });

    it('ignores non-secret strings', () => {
        const config = { name: 'my-bot', url: 'https://example.com' };
        const refs = collectSecretRefs(config);
        expect(refs).toHaveLength(0);
    });

    it('groups refs by provider', () => {
        const refs = [
            { source: 'env' as const, provider: 'default', id: 'A' },
            { source: 'env' as const, provider: 'default', id: 'B' },
            { source: 'file' as const, provider: 'vault', id: 'C' },
        ];
        const groups = groupRefsByProvider(refs);
        expect(groups.size).toBe(2);
        expect(groups.get('env:default')).toHaveLength(2);
        expect(groups.get('file:vault')).toHaveLength(1);
    });

    it('builds resolution plan summary', () => {
        const refs = [
            { source: 'env' as const, provider: 'default', id: 'X' },
            { source: 'exec' as const, provider: 'vault', id: 'Y' },
        ];
        const summary = buildResolutionPlanSummary(refs);
        expect(summary.totalRefs).toBe(2);
        expect(summary.providers).toHaveLength(2);
    });
});
