/**
 * CoreBlow Phase 37 — Hook Lifecycle Pipeline Chain Tests
 *
 * Layer 2 (Pipeline):
 *   parseFrontmatter → resolveMetadata → resolvePolicy → HookBus.fire
 */
import { describe, it, expect } from 'vitest';
import { parseFrontmatter, resolveHookMetadata, resolveHookInvocationPolicy } from '../../src/hooks/frontmatter.js';
import { resolveHookEnableState, resolveHookEntries, type PolicyHookEntry } from '../../src/hooks/policy.js';
import { HookBus } from '../../src/hooks/hook-bus.js';
import type { Hook } from '../../src/hooks/types.js';

describe('Phase37 Chain: Hook Lifecycle Pipeline', () => {

    it('parse frontmatter → resolve metadata → check policy → fire event', async () => {
        // Step 1: Parse
        const content = `---
name: log-messages
events: message:received,message:sent
enabled: true
---
Log all messages.`;

        const fm = parseFrontmatter(content);
        expect(fm.name).toBe('log-messages');

        // Step 2: Resolve metadata
        const meta = resolveHookMetadata(fm);
        expect(meta?.events).toEqual(['message:received', 'message:sent']);

        // Step 3: Check invocation policy
        const policy = resolveHookInvocationPolicy(fm);
        expect(policy.enabled).toBe(true);

        // Step 4: Fire events on bus
        const bus = new HookBus();
        const received: string[] = [];
        for (const event of meta!.events) {
            bus.on(event, () => { received.push(event); });
        }
        await bus.fire('message:received', { text: 'hello' });
        await bus.fire('message:sent', { text: 'reply' });
        expect(received).toEqual(['message:received', 'message:sent']);
    });

    it('multiple hooks → resolve collisions → only winners fire', async () => {
        const makeHook = (name: string, source: Hook['source']): Hook => ({
            name, description: '', source,
            filePath: '', baseDir: '', handlerPath: '',
        });

        const entries: PolicyHookEntry[] = [
            { hook: makeHook('formatter', 'coreblow-bundled'), frontmatter: {} },
            { hook: makeHook('formatter', 'coreblow-plugin'), frontmatter: {} },  // should win
            { hook: makeHook('logger', 'coreblow-bundled'), frontmatter: {} },     // no collision
        ];

        const resolved = resolveHookEntries(entries);
        expect(resolved).toHaveLength(2);

        const names = resolved.map(e => `${e.hook.name}:${e.hook.source}`);
        expect(names).toContain('formatter:coreblow-plugin');
        expect(names).toContain('logger:coreblow-bundled');
    });

    it('hook enable state → only enabled hooks register on bus', async () => {
        const bus = new HookBus();
        const makeEntry = (name: string, source: Hook['source']): PolicyHookEntry => ({
            hook: { name, description: '', source, filePath: '', baseDir: '', handlerPath: '' },
            frontmatter: {},
        });

        const hooks = [
            { entry: makeEntry('always-on', 'coreblow-bundled'), expected: true },
            { entry: makeEntry('opt-in', 'coreblow-workspace'), expected: false },
            { entry: makeEntry('plugin', 'coreblow-plugin'), expected: true },
        ];

        for (const h of hooks) {
            const state = resolveHookEnableState({ entry: h.entry });
            expect(state.enabled).toBe(h.expected);
            if (state.enabled) {
                bus.on(h.entry.hook.name, () => {});
            }
        }

        expect(bus.hasListeners('always-on')).toBe(true);
        expect(bus.hasListeners('opt-in')).toBe(false);
        expect(bus.hasListeners('plugin')).toBe(true);
    });
});
