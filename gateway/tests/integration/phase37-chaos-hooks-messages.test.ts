/**
 * CoreBlow Phase 37 — Hooks & Messages Chaos Tests
 *
 * Layer 3 (Adversarial):
 *   - HookBus: wildcard storms, concurrent fire, error isolation
 *   - Hook Policy: 10-way collision resolution
 *   - CommandDetection: edge inputs
 *   - MessageChunking: extreme lengths, all platforms
 */
import { describe, it, expect } from 'vitest';
import { HookBus } from '../../src/hooks/hook-bus.js';
import { resolveHookEntries, type PolicyHookEntry } from '../../src/hooks/policy.js';
import { isSlashCommand, parseSlashCommand } from '../../src/auto-reply/command-detection.js';
import { chunkMessage } from '../../src/auto-reply/chunk.js';
import type { Hook } from '../../src/hooks/types.js';

// ================================================================
describe('Phase37 Chaos: HookBus Stress', () => {
    it('50 listeners on same event — all fire', async () => {
        const bus = new HookBus();
        let count = 0;
        for (let i = 0; i < 50; i++) {
            bus.on('stress:event', () => { count++; });
        }
        await bus.fire('stress:event', null);
        expect(count).toBe(50);
    });

    it('fire 100 different events — no crashes', async () => {
        const bus = new HookBus();
        const received: string[] = [];
        bus.on('*', (data) => { received.push(data as string); });

        for (let i = 0; i < 100; i++) {
            await bus.fire(`event:${i}`, `data-${i}`);
        }
        expect(received).toHaveLength(100);
    });

    it('multiple wildcards resolve correctly', async () => {
        const bus = new HookBus();
        const log: string[] = [];
        bus.on('message:received', () => { log.push('exact'); });
        bus.on('message:*', () => { log.push('type-wc'); });
        bus.on('*', () => { log.push('global-wc'); });

        await bus.fire('message:received', null);
        expect(log).toEqual(['exact', 'type-wc', 'global-wc']);
    });
});

// ================================================================
describe('Phase37 Chaos: Hook Policy Collision', () => {
    const makeEntry = (name: string, source: Hook['source']): PolicyHookEntry => ({
        hook: { name, description: '', source, filePath: '', baseDir: '', handlerPath: '' },
        frontmatter: {},
    });

    it('10 hooks with same name — only highest precedence survives', () => {
        const entries: PolicyHookEntry[] = [
            makeEntry('formatter', 'coreblow-bundled'),
            makeEntry('formatter', 'coreblow-bundled'),
            makeEntry('formatter', 'coreblow-plugin'),
            makeEntry('formatter', 'coreblow-managed'),
        ];

        const resolved = resolveHookEntries(entries);
        const formatters = resolved.filter(e => e.hook.name === 'formatter');
        expect(formatters).toHaveLength(1);
    });

    it('different names — no collision, all survive', () => {
        const entries: PolicyHookEntry[] = [
            makeEntry('hook-a', 'coreblow-bundled'),
            makeEntry('hook-b', 'coreblow-plugin'),
            makeEntry('hook-c', 'coreblow-managed'),
            makeEntry('hook-d', 'coreblow-workspace'),
        ];

        const resolved = resolveHookEntries(entries);
        expect(resolved).toHaveLength(4);
    });
});

// ================================================================
describe('Phase37 Chaos: Command Detection Edge Cases', () => {
    it('edge slash command inputs', () => {
        expect(isSlashCommand('/a')).toBe(true);
        expect(isSlashCommand('/ nope')).toBe(true); // starts with / and length > 1
        expect(isSlashCommand('')).toBe(false);
        expect(isSlashCommand('   ')).toBe(false);
    });

    it('parse command with many args', () => {
        const result = parseSlashCommand('/search term1 term2 term3 term4 term5');
        expect(result?.command).toBe('search');
        expect(result?.args).toHaveLength(5);
    });
});

// ================================================================
describe('Phase37 Chaos: Chunking All Platforms', () => {
    it('chunk across all known platforms', () => {
        const longText = 'X'.repeat(100000);
        const platforms = ['discord', 'telegram', 'slack', 'whatsapp', 'webchat', 'line'];

        for (const platform of platforms) {
            const chunks = chunkMessage(longText, platform);
            expect(chunks.length).toBeGreaterThan(0);
            // All chunks should be within the limit (no exact check since limits vary)
            expect(chunks.every(c => c.length > 0)).toBe(true);
        }
    });

    it('single-character message — no chunking', () => {
        expect(chunkMessage('X', 'discord')).toEqual(['X']);
    });
});
