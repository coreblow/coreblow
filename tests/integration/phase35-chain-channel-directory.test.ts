/**
 * CoreBlow Phase 35 — Channel→Directory→Resolve Pipeline Chain Tests
 *
 * Layer 2 (Pipeline):
 *   registerAdapter → registerDirectoryProvider → resolveTargets → searchContacts
 */
import { describe, it, expect } from 'vitest';
import {
    registerDirectoryProvider, getDirectoryProvider,
    resolveTargets, searchContacts,
    type DirectoryProvider, type DirectoryEntry,
} from '../../src/channels/directory.js';

describe('Phase35 Chain: Channel→Directory→Resolve Pipeline', () => {

    it('register providers → resolve targets across channels', async () => {
        // Register Telegram provider
        const telegramProvider: DirectoryProvider = {
            resolveTargets: async (inputs) => inputs.map(input => ({
                input, resolved: true, id: `tg-${input}`, name: `TG ${input}`,
                note: 'matched by username',
            })),
        };
        registerDirectoryProvider('telegram', 'bot-main', telegramProvider);

        // Register Discord provider
        const discordProvider: DirectoryProvider = {
            resolveTargets: async (inputs) => inputs.map(input => ({
                input, resolved: true, id: `dc-${input}`, name: `DC ${input}`,
            })),
        };
        registerDirectoryProvider('discord', 'server-main', discordProvider);

        // Resolve on Telegram
        const tgResults = await resolveTargets('telegram', 'bot-main', ['alice', 'bob']);
        expect(tgResults).toHaveLength(2);
        expect(tgResults[0]?.id).toBe('tg-alice');

        // Resolve on Discord
        const dcResults = await resolveTargets('discord', 'server-main', ['charlie']);
        expect(dcResults[0]?.id).toBe('dc-charlie');
    });

    it('search contacts across channels with filter', async () => {
        // Register provider with listPeers
        const provider: DirectoryProvider = {
            listPeers: async (query, limit) => {
                const all: DirectoryEntry[] = [
                    { id: 'u1', kind: 'user', name: 'Alice Smith' },
                    { id: 'u2', kind: 'user', name: 'Bob Jones' },
                    { id: 'u3', kind: 'user', name: 'Alice Cooper' },
                ];
                return all.filter(p => !query || p.name.toLowerCase().includes(query.toLowerCase()))
                    .slice(0, limit);
            },
        };
        registerDirectoryProvider('telegram', 'search-bot', provider);

        const results = await searchContacts('alice', { channels: ['telegram'], limit: 10 });
        expect(results.length).toBeGreaterThanOrEqual(2);
        expect(results.every(r => r.name.toLowerCase().includes('alice'))).toBe(true);
    });

    it('resolve with no provider → passthrough fallback', async () => {
        const results = await resolveTargets('whatsapp', 'no-provider', ['raw-id-123']);
        expect(results).toHaveLength(1);
        expect(results[0]?.resolved).toBe(true);
        expect(results[0]?.id).toBe('raw-id-123');
        expect(results[0]?.note).toContain('passthrough');
    });
});
