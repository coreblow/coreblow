import { describe, it, expect, beforeEach } from 'vitest';
import { SkillRegistry } from '../../src/skills/registry.js';
import type { SkillEntry } from '../../src/skills/types.js';

function makeSkill(id: string, source: 'bundled' | 'workspace' | 'remote' = 'workspace'): SkillEntry {
    return {
        id,
        baseDir: `/skills/${id}`,
        markdownPath: `/skills/${id}/SKILL.md`,
        instructions: '# Instructions',
        metadata: { name: id, description: `${id} skill` },
        source,
    };
}

describe('SkillRegistry', () => {
    let registry: SkillRegistry;

    beforeEach(() => {
        registry = new SkillRegistry();
    });

    it('registers and retrieves skills', () => {
        registry.register(makeSkill('alpha'));
        registry.register(makeSkill('beta'));
        expect(registry.list()).toHaveLength(2);
    });

    it('getById returns correct skill', () => {
        registry.register(makeSkill('alpha'));
        expect(registry.getById('alpha')?.metadata.name).toBe('alpha');
        expect(registry.getById('missing')).toBeUndefined();
    });

    it('overwrites on duplicate id', () => {
        const first = makeSkill('alpha');
        first.metadata.description = 'first';
        registry.register(first);

        const second = makeSkill('alpha');
        second.metadata.description = 'second';
        registry.register(second);

        expect(registry.list()).toHaveLength(1);
        expect(registry.getById('alpha')?.metadata.description).toBe('second');
    });

    it('unregisters by id', () => {
        registry.register(makeSkill('alpha'));
        expect(registry.unregister('alpha')).toBe(true);
        expect(registry.list()).toHaveLength(0);
    });

    it('unregister returns false for missing skill', () => {
        expect(registry.unregister('nonexistent')).toBe(false);
    });

    it('getBySource filters correctly', () => {
        registry.register(makeSkill('a', 'bundled'));
        registry.register(makeSkill('b', 'workspace'));
        registry.register(makeSkill('c', 'remote'));

        expect(registry.getBySource('bundled')).toHaveLength(1);
        expect(registry.getBySource('workspace')).toHaveLength(1);
        expect(registry.getBySource('remote')).toHaveLength(1);
    });

    it('clear removes all skills', () => {
        registry.register(makeSkill('alpha'));
        registry.register(makeSkill('beta'));
        registry.clear();
        expect(registry.list()).toEqual([]);
    });

    it('discover loads skills from filesystem', async () => {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const tmpDir = path.join('/tmp', `skill-reg-test-${Date.now()}`);
        const skillDir = path.join(tmpDir, 'test-skill');

        fs.mkdirSync(skillDir, { recursive: true });
        fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `---
name: Discovered
description: Found by discover
---
# Do the thing`);

        const count = await registry.discover(tmpDir, 'workspace');
        expect(count).toBe(1);
        expect(registry.list()).toHaveLength(1);
        expect(registry.getById('test-skill')?.metadata.name).toBe('Discovered');

        fs.rmSync(tmpDir, { recursive: true });
    });
});
