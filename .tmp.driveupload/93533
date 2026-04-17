/**
 * CoreBlow Phase 36 — SkillParser & SkillRegistry Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - SkillParser: SKILL.md parsing, frontmatter, YAML values, edge formats
 *   - SkillRegistry: CRUD, discover, getBySource, clear
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { parseSkillContent } from '../../src/skills/parser.js';
import { SkillRegistry } from '../../src/skills/registry.js';
import type { SkillEntry } from '../../src/skills/types.js';

// ================================================================
describe('SkillParser — Extended', () => {
    it('should parse valid SKILL.md with frontmatter', () => {
        const content = `---
name: web-search
description: Search the web for information
user-invocable: true
---
# Web Search Skill

Use this skill to search the internet.`;

        const result = parseSkillContent(content, '/skills/web-search/SKILL.md');
        expect(result).not.toBeNull();
        expect(result?.meta.name).toBe('web-search');
        expect(result?.meta.description).toBe('Search the web for information');
        expect(result?.meta['user-invocable']).toBe(true);
        expect(result?.instructions).toContain('Web Search Skill');
    });

    it('should parse boolean and number values', () => {
        const content = `---
name: test-skill
description: Test
disable-model-invocation: false
---
Body`;

        const result = parseSkillContent(content);
        expect(result?.meta['disable-model-invocation']).toBe(false);
    });

    it('should return null for missing frontmatter', () => {
        const content = `# No frontmatter here\nJust markdown.`;
        expect(parseSkillContent(content)).toBeNull();
    });

    it('should return null for missing name', () => {
        const content = `---
description: No name
---
Body`;

        expect(parseSkillContent(content)).toBeNull();
    });

    it('should parse command-dispatch field', () => {
        const content = `---
name: code-exec
description: Execute code
command-dispatch: tool
command-tool: exec_command
---
Instructions here`;

        const result = parseSkillContent(content);
        expect(result?.meta['command-dispatch']).toBe('tool');
        expect(result?.meta['command-tool']).toBe('exec_command');
    });

    it('should extract instructions body correctly', () => {
        const content = `---
name: test
description: test
---

## Step 1
Do this first.

## Step 2
Do this second.`;

        const result = parseSkillContent(content);
        expect(result?.instructions).toContain('Step 1');
        expect(result?.instructions).toContain('Step 2');
    });
});

// ================================================================
describe('SkillRegistry — Extended', () => {
    let reg: SkillRegistry;
    const makeEntry = (id: string, source: 'bundled' | 'workspace' | 'remote' = 'workspace'): SkillEntry => ({
        id,
        source,
        baseDir: `/skills/${id}`,
        markdownPath: `/skills/${id}/SKILL.md`,
        instructions: `Instructions for ${id}`,
        metadata: { name: id, description: `${id} skill`, events: [] },
    });

    beforeEach(() => { reg = new SkillRegistry(); });

    it('should register and retrieve skill', () => {
        reg.register(makeEntry('web-search'));
        expect(reg.getById('web-search')).toBeDefined();
        expect(reg.getById('web-search')?.metadata.name).toBe('web-search');
    });

    it('should list all skills', () => {
        reg.register(makeEntry('a'));
        reg.register(makeEntry('b'));
        reg.register(makeEntry('c'));
        expect(reg.list()).toHaveLength(3);
    });

    it('should unregister a skill', () => {
        reg.register(makeEntry('temp'));
        expect(reg.unregister('temp')).toBe(true);
        expect(reg.getById('temp')).toBeUndefined();
    });

    it('should return false for unregistering non-existent', () => {
        expect(reg.unregister('ghost')).toBe(false);
    });

    it('should filter by source', () => {
        reg.register(makeEntry('a', 'bundled'));
        reg.register(makeEntry('b', 'workspace'));
        reg.register(makeEntry('c', 'bundled'));
        reg.register(makeEntry('d', 'remote'));

        expect(reg.getBySource('bundled')).toHaveLength(2);
        expect(reg.getBySource('workspace')).toHaveLength(1);
        expect(reg.getBySource('remote')).toHaveLength(1);
    });

    it('should overwrite skill with same ID', () => {
        reg.register(makeEntry('skill-1'));
        reg.register({ ...makeEntry('skill-1'), metadata: { name: 'updated', description: 'new', events: [] } });
        expect(reg.getById('skill-1')?.metadata.name).toBe('updated');
    });

    it('should clear all skills', () => {
        reg.register(makeEntry('a'));
        reg.register(makeEntry('b'));
        reg.clear();
        expect(reg.list()).toHaveLength(0);
    });
});
