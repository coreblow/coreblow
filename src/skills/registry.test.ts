/**
 * CoreBlow — Skill Registry Tests
 *
 * Tests for skill registration, discovery, lookup,
 * listing by source, and lifecycle operations.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SkillRegistry } from './registry.js';
import type { SkillEntry } from './types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

function makeEntry(overrides: Partial<SkillEntry> = {}): SkillEntry {
    return {
        id: overrides.id ?? 'test-skill',
        baseDir: overrides.baseDir ?? '/tmp/skills/test-skill',
        markdownPath: overrides.markdownPath ?? '/tmp/skills/test-skill/SKILL.md',
        instructions: overrides.instructions ?? '# Test instructions',
        metadata: overrides.metadata ?? { name: 'test-skill', description: 'A test' },
        source: overrides.source ?? 'workspace',
    };
}

describe('SkillRegistry', () => {
    let registry: SkillRegistry;

    beforeEach(() => {
        registry = new SkillRegistry();
    });

    // === Manual Registration ===

    describe('register / getById', () => {
        it('registers and retrieves a skill', () => {
            registry.register(makeEntry({ id: 'slack' }));
            const skill = registry.getById('slack');
            expect(skill?.id).toBe('slack');
            expect(skill?.metadata.name).toBe('test-skill');
        });

        it('overwrites existing skill with same id', () => {
            registry.register(makeEntry({ id: 'dup', instructions: 'v1' }));
            registry.register(makeEntry({ id: 'dup', instructions: 'v2' }));
            expect(registry.getById('dup')?.instructions).toBe('v2');
        });
    });

    describe('unregister', () => {
        it('removes a registered skill', () => {
            registry.register(makeEntry({ id: 'remove-me' }));
            expect(registry.unregister('remove-me')).toBe(true);
            expect(registry.getById('remove-me')).toBeUndefined();
        });

        it('returns false for non-existent skill', () => {
            expect(registry.unregister('ghost')).toBe(false);
        });
    });

    // === Listing ===

    describe('list', () => {
        it('returns all registered skills', () => {
            registry.register(makeEntry({ id: 'a' }));
            registry.register(makeEntry({ id: 'b' }));
            registry.register(makeEntry({ id: 'c' }));

            const list = registry.list();
            expect(list).toHaveLength(3);
            expect(list.map(s => s.id)).toEqual(expect.arrayContaining(['a', 'b', 'c']));
        });

        it('returns empty when no skills registered', () => {
            expect(registry.list()).toEqual([]);
        });
    });

    describe('getBySource', () => {
        it('filters skills by source', () => {
            registry.register(makeEntry({ id: 'bundled-1', source: 'bundled' }));
            registry.register(makeEntry({ id: 'ws-1', source: 'workspace' }));
            registry.register(makeEntry({ id: 'remote-1', source: 'remote' }));

            expect(registry.getBySource('bundled')).toHaveLength(1);
            expect(registry.getBySource('workspace')).toHaveLength(1);
            expect(registry.getBySource('remote')).toHaveLength(1);
        });

        it('returns empty for source with no skills', () => {
            expect(registry.getBySource('remote')).toEqual([]);
        });
    });

    // === Discovery ===

    describe('discover', () => {
        let tmpDir: string;

        beforeEach(() => {
            tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-registry-test-'));
            // Create test skills
            for (const skill of ['alpha', 'beta']) {
                const dir = path.join(tmpDir, skill);
                fs.mkdirSync(dir);
                fs.writeFileSync(path.join(dir, 'SKILL.md'),
                    `---\nname: ${skill}\ndescription: ${skill} skill\n---\n# ${skill}`);
            }
        });

        afterEach(() => {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        });

        it('discovers skills from filesystem', async () => {
            const count = await registry.discover(tmpDir, 'bundled');
            expect(count).toBe(2);
            expect(registry.list()).toHaveLength(2);
        });

        it('registers discovered skills with correct source', async () => {
            await registry.discover(tmpDir, 'workspace');
            const skills = registry.getBySource('workspace');
            expect(skills).toHaveLength(2);
        });

        it('returns 0 for empty directory', async () => {
            const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-empty-'));
            const count = await registry.discover(emptyDir);
            expect(count).toBe(0);
            fs.rmSync(emptyDir, { recursive: true });
        });
    });

    // === Clear ===

    describe('clear', () => {
        it('removes all skills', () => {
            registry.register(makeEntry({ id: 'a' }));
            registry.register(makeEntry({ id: 'b' }));
            registry.clear();
            expect(registry.list()).toEqual([]);
        });
    });
});
