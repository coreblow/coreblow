import { describe, it, expect, beforeEach } from 'vitest';
import { ContributionRegistry, type FlowContribution } from '../../src/flows/contributions.js';

describe('ContributionRegistry', () => {
    let registry: ContributionRegistry;

    beforeEach(() => {
        registry = new ContributionRegistry();
    });

    it('registers and retrieves contributions for a flow', () => {
        registry.register({ id: 'c1', flowId: 'setup', priority: 10, content: 'step-a' });
        registry.register({ id: 'c2', flowId: 'setup', priority: 20, content: 'step-b' });
        registry.register({ id: 'c3', flowId: 'other', priority: 10, content: 'step-x' });

        const forSetup = registry.getForFlow('setup');
        expect(forSetup).toHaveLength(2);
        expect(forSetup[0].id).toBe('c1'); // lower priority first
    });

    it('unregisters by id', () => {
        registry.register({ id: 'c1', flowId: 'setup', priority: 10, content: 'a' });
        expect(registry.unregister('c1')).toBe(true);
        expect(registry.getForFlow('setup')).toHaveLength(0);
    });

    it('unregister returns false for missing id', () => {
        expect(registry.unregister('nonexistent')).toBe(false);
    });

    it('maintains priority order', () => {
        registry.register({ id: 'high', flowId: 'f', priority: 100, content: 'h' });
        registry.register({ id: 'low', flowId: 'f', priority: 1, content: 'l' });
        registry.register({ id: 'mid', flowId: 'f', priority: 50, content: 'm' });

        const result = registry.getForFlow('f');
        expect(result.map(c => c.id)).toEqual(['low', 'mid', 'high']);
    });

    describe('merge', () => {
        it('merges with injectBefore', () => {
            registry.register({
                id: 'injected', flowId: 'f', priority: 10,
                injectBefore: 'b', content: { id: 'injected', label: 'X' },
            });

            const base = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }];
            const merged = registry.merge(base, (c) => c.content);
            expect(merged.map(m => m.id)).toEqual(['a', 'injected', 'b', 'c']);
        });

        it('merges with injectAfter', () => {
            registry.register({
                id: 'injected', flowId: 'f', priority: 10,
                injectAfter: 'a', content: { id: 'injected', label: 'X' },
            });

            const base = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];
            const merged = registry.merge(base, (c) => c.content);
            expect(merged.map(m => m.id)).toEqual(['a', 'injected', 'b']);
        });

        it('appends to end when no anchor found', () => {
            registry.register({
                id: 'injected', flowId: 'f', priority: 10,
                injectAfter: 'nonexistent', content: { id: 'injected', label: 'X' },
            });

            const base = [{ id: 'a', label: 'A' }];
            const merged = registry.merge(base, (c) => c.content);
            expect(merged.map(m => m.id)).toEqual(['a', 'injected']);
        });

        it('appends to end when no anchor specified', () => {
            registry.register({
                id: 'injected', flowId: 'f', priority: 10,
                content: { id: 'injected', label: 'X' },
            });

            const base = [{ id: 'a', label: 'A' }];
            const merged = registry.merge(base, (c) => c.content);
            expect(merged.map(m => m.id)).toEqual(['a', 'injected']);
        });
    });

    it('clear removes everything', () => {
        registry.register({ id: 'c1', flowId: 'f', priority: 10, content: 'a' });
        registry.clear();
        expect(registry.getForFlow('f')).toEqual([]);
    });
});
