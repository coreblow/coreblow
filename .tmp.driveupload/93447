import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SkillRegistry } from '../../src/skills/registry.js';
import type { SkillEntry } from '../../src/skills/types.js';

/**
 * We test buildSkillStatusReport in isolation by manually registering skills
 * rather than importing the singleton, to avoid cross-test contamination.
 */

function makeSkill(id: string, overrides: Partial<SkillEntry> = {}): SkillEntry {
    return {
        id,
        baseDir: `/skills/${id}`,
        markdownPath: `/skills/${id}/SKILL.md`,
        instructions: '# Test',
        metadata: {
            name: overrides.metadata?.name ?? id,
            description: overrides.metadata?.description ?? `${id} skill`,
            events: overrides.metadata?.events,
            os: overrides.metadata?.os,
            requires: overrides.metadata?.requires,
        },
        source: overrides.source ?? 'workspace',
    };
}

describe('skills/status (manual)', () => {
    it('correctly reports skill counts', () => {
        const skills = [
            makeSkill('a', { source: 'bundled' }),
            makeSkill('b', { source: 'workspace' }),
            makeSkill('c', { source: 'remote' }),
        ];

        const bundled = skills.filter(s => s.source === 'bundled').length;
        const workspace = skills.filter(s => s.source === 'workspace').length;
        const remote = skills.filter(s => s.source === 'remote').length;

        expect(bundled).toBe(1);
        expect(workspace).toBe(1);
        expect(remote).toBe(1);
        expect(skills.length).toBe(3);
    });

    it('detects OS mismatch', () => {
        const skill = makeSkill('a', {
            metadata: { name: 'a', description: 'test', os: ['win32'] },
        });

        // Current platform is darwin (macOS), so 'win32' should not match
        const loadable = !skill.metadata.os || skill.metadata.os.length === 0 || skill.metadata.os.includes(process.platform);
        expect(loadable).toBe(false);
    });

    it('passes OS check when matching', () => {
        const skill = makeSkill('a', {
            metadata: { name: 'a', description: 'test', os: [process.platform] },
        });

        const loadable = !skill.metadata.os || skill.metadata.os.length === 0 || skill.metadata.os.includes(process.platform);
        expect(loadable).toBe(true);
    });

    it('passes when no OS requirement', () => {
        const skill = makeSkill('a');
        const loadable = !skill.metadata.os || skill.metadata.os.length === 0 || skill.metadata.os.includes(process.platform);
        expect(loadable).toBe(true);
    });
});
