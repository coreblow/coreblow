/**
 * CoreBlow Phase 36 — Dispatcher Stress & Chaos Tests
 *
 * Layer 3 (Adversarial):
 *   - Dispatcher edge inputs: special chars, very long input
 *   - Middleware error propagation
 *   - Skill parser malformed YAML
 *   - Cooldown timing edge cases
 *   - AutoComplete with large command sets
 */
import { describe, it, expect } from 'vitest';
import { CommandDispatcher } from '../../src/commands/dispatcher.js';
import { parseSkillContent } from '../../src/skills/parser.js';
import { SkillRegistry } from '../../src/skills/registry.js';
import { CommandCooldown } from '../../src/commands/cooldown.js';
import { AutoComplete } from '../../src/commands/autocomplete.js';

// ================================================================
describe('Phase36 Chaos: Dispatcher Edge Inputs', () => {
    it('dispatch 20 different commands → history accurate', async () => {
        const dispatcher = new CommandDispatcher();
        for (let i = 0; i < 15; i++) {
            dispatcher.register({
                name: `cmd-${i}`, description: `Command ${i}`,
                handler: async () => `result-${i}`,
            });
        }

        for (let i = 0; i < 15; i++) {
            await dispatcher.dispatch(`/cmd-${i}`);
        }
        // Also dispatch built-ins
        await dispatcher.dispatch('/help');
        await dispatcher.dispatch('/status');
        await dispatcher.dispatch('/doctor');
        await dispatcher.dispatch('/reset');
        await dispatcher.dispatch('/clear');

        const history = dispatcher.getHistory();
        expect(history).toHaveLength(20);
    });

    it('command with special characters in args', async () => {
        const dispatcher = new CommandDispatcher();
        dispatcher.register({
            name: 'echo', description: 'Echo',
            handler: async (ctx) => ctx.args.join(' '),
        });

        const result = await dispatcher.dispatch('/echo hello world @user #channel');
        expect(result.output).toBe('hello world @user #channel');
    });

    it('middleware error stops execution', async () => {
        const dispatcher = new CommandDispatcher();
        dispatcher.use(async () => { throw new Error('middleware-blocked'); });
        dispatcher.register({
            name: 'blocked', description: 'Should not run',
            handler: async () => 'should-not-reach',
        });

        const result = await dispatcher.dispatch('/blocked');
        expect(result.error).toContain('middleware-blocked');
        expect(result.output).toBeUndefined();
    });
});

// ================================================================
describe('Phase36 Chaos: Skill Parser Malformed Input', () => {
    it('frontmatter with only dashes — returns null', () => {
        expect(parseSkillContent('---\n---\nBody')).toBeNull();
    });

    it('50 skills registered → filter by source accurate', () => {
        const reg = new SkillRegistry();
        for (let i = 0; i < 20; i++) {
            reg.register({
                id: `bundled-${i}`, source: 'bundled', baseDir: `/b/${i}`,
                markdownPath: `/b/${i}/SKILL.md`, instructions: 'inst',
                metadata: { name: `bundled-${i}`, description: '', events: [] },
            });
        }
        for (let i = 0; i < 30; i++) {
            reg.register({
                id: `workspace-${i}`, source: 'workspace', baseDir: `/w/${i}`,
                markdownPath: `/w/${i}/SKILL.md`, instructions: 'inst',
                metadata: { name: `workspace-${i}`, description: '', events: [] },
            });
        }

        expect(reg.list()).toHaveLength(50);
        expect(reg.getBySource('bundled')).toHaveLength(20);
        expect(reg.getBySource('workspace')).toHaveLength(30);
    });
});

// ================================================================
describe('Phase36 Chaos: Cooldown & AutoComplete Edge Cases', () => {
    it('cooldown with 0ms → always allows', () => {
        const cd = new CommandCooldown(0);
        expect(cd.check('user', 'cmd')).toBe(true);
        expect(cd.check('user', 'cmd')).toBe(true);
    });

    it('autocomplete with 100 commands', () => {
        const ac = new AutoComplete();
        const cmds = Array.from({ length: 100 }, (_, i) => `cmd-${String(i).padStart(3, '0')}`);
        ac.setCommands(cmds);

        expect(ac.complete('cmd-00')).toHaveLength(10); // cmd-000 to cmd-009
        expect(ac.complete('cmd-099')).toHaveLength(1);  // exact match
        expect(ac.complete('zzz')).toHaveLength(0);
    });

    it('autocomplete results are sorted', () => {
        const ac = new AutoComplete();
        ac.setCommands(['zebra', 'apple', 'mango', 'apricot']);
        const results = ac.complete('a');
        expect(results).toEqual(['apple', 'apricot']);
    });
});
