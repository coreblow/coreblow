import { describe, it, expect, beforeEach } from 'vitest';
import { PromptManager } from './prompt-manager.js';

describe('PromptManager', () => {
    let pm: PromptManager;

    beforeEach(() => {
        pm = new PromptManager();
    });

    describe('register + get', () => {
        it('registers a prompt', () => {
            const tpl = pm.register('sys', 'System', 'You are helpful');
            expect(tpl.id).toBe('sys');
            expect(tpl.version).toBe(1);
        });

        it('retrieves registered prompt', () => {
            pm.register('sys', 'System', 'content');
            expect(pm.get('sys')).not.toBeNull();
            expect(pm.get('sys')!.content).toBe('content');
        });

        it('returns null for unknown', () => {
            expect(pm.get('ghost')).toBeNull();
        });
    });

    describe('versioning', () => {
        it('increments version on re-register', () => {
            pm.register('sys', 'System', 'v1');
            pm.register('sys', 'System', 'v2');
            expect(pm.get('sys')!.version).toBe(2);
        });

        it('preserves version history', () => {
            pm.register('sys', 'System', 'v1');
            pm.register('sys', 'System', 'v2');
            pm.register('sys', 'System', 'v3');
            const versions = pm.getVersions('sys');
            expect(versions).toHaveLength(3);
            expect(versions[0]!.content).toBe('v1');
            expect(versions[2]!.content).toBe('v3');
        });
    });

    describe('variable extraction + render', () => {
        it('extracts variables from template', () => {
            const tpl = pm.register('greet', 'Greeting', 'Hello {{name}}, welcome to {{place}}');
            expect(tpl.variables).toEqual(['name', 'place']);
        });

        it('renders with variables', () => {
            pm.register('greet', 'Greeting', 'Hello {{name}}!');
            const result = pm.render('greet', { name: 'Alice' });
            expect(result).toBe('Hello Alice!');
        });

        it('renders without variables', () => {
            pm.register('sys', 'System', 'Static prompt');
            expect(pm.render('sys')).toBe('Static prompt');
        });

        it('returns null for unknown prompt', () => {
            expect(pm.render('ghost')).toBeNull();
        });

        it('replaces multiple occurrences', () => {
            pm.register('x', 'X', '{{v}} and {{v}}');
            expect(pm.render('x', { v: 'yes' })).toBe('yes and yes');
        });
    });

    describe('chains', () => {
        it('renders chain of prompts', () => {
            pm.register('a', 'A', 'Part A');
            pm.register('b', 'B', 'Part B');
            pm.registerChain('chain1', 'Chain', ['a', 'b']);
            const result = pm.renderChain('chain1');
            expect(result).toBe('Part A\n\nPart B');
        });

        it('uses custom separator', () => {
            pm.register('a', 'A', 'X');
            pm.register('b', 'B', 'Y');
            pm.registerChain('chain1', 'Chain', ['a', 'b'], '\n---\n');
            expect(pm.renderChain('chain1')).toBe('X\n---\nY');
        });

        it('injects variables into chain', () => {
            pm.register('a', 'A', 'Hello {{name}}');
            pm.register('b', 'B', 'Role: {{role}}');
            pm.registerChain('chain1', 'Chain', ['a', 'b']);
            const result = pm.renderChain('chain1', { name: 'Bob', role: 'admin' });
            expect(result).toContain('Hello Bob');
            expect(result).toContain('Role: admin');
        });

        it('returns null for unknown chain', () => {
            expect(pm.renderChain('ghost')).toBeNull();
        });
    });

    describe('list + tags', () => {
        it('lists all prompts', () => {
            pm.register('a', 'A', 'x', ['agent']);
            pm.register('b', 'B', 'y', ['system']);
            expect(pm.list()).toHaveLength(2);
        });

        it('filters by tag', () => {
            pm.register('a', 'A', 'x', ['agent']);
            pm.register('b', 'B', 'y', ['system']);
            expect(pm.list('agent')).toHaveLength(1);
            expect(pm.list('agent')[0]!.id).toBe('a');
        });
    });

    describe('delete + count', () => {
        it('deletes a prompt', () => {
            pm.register('a', 'A', 'x');
            expect(pm.delete('a')).toBe(true);
            expect(pm.get('a')).toBeNull();
        });

        it('returns false for unknown delete', () => {
            expect(pm.delete('ghost')).toBe(false);
        });

        it('counts prompts', () => {
            pm.register('a', 'A', 'x');
            pm.register('b', 'B', 'y');
            expect(pm.count()).toBe(2);
        });
    });
});
