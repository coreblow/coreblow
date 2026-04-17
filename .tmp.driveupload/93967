/**
 * CoreBlow Phase 36 — Skill Parser→Registry→Status Pipeline Chain Tests
 *
 * Layer 2 (Pipeline):
 *   parseSkillContent → SkillRegistry.register → buildSkillStatusReport
 */
import { describe, it, expect } from 'vitest';
import { parseSkillContent } from '../../src/skills/parser.js';
import { SkillRegistry } from '../../src/skills/registry.js';
import type { SkillEntry } from '../../src/skills/types.js';

describe('Phase36 Chain: Skill Discovery Pipeline', () => {

    it('parse SKILL.md → register in registry → list and filter', () => {
        const reg = new SkillRegistry();

        // Parse multiple skill files
        const skills = [
            { content: `---\nname: web-search\ndescription: Search the web\n---\nInstructions`, source: 'bundled' as const },
            { content: `---\nname: code-exec\ndescription: Execute code\n---\nInstructions`, source: 'bundled' as const },
            { content: `---\nname: custom-tool\ndescription: Custom tool\n---\nInstructions`, source: 'workspace' as const },
        ];

        for (const s of skills) {
            const parsed = parseSkillContent(s.content, `/skills/${s.source}/SKILL.md`);
            if (parsed) {
                const entry: SkillEntry = {
                    id: parsed.meta.name,
                    source: s.source,
                    baseDir: `/skills/${parsed.meta.name}`,
                    markdownPath: parsed.filePath,
                    instructions: parsed.instructions,
                    metadata: { name: parsed.meta.name, description: parsed.meta.description, events: [] },
                };
                reg.register(entry);
            }
        }

        // Verify registry state
        expect(reg.list()).toHaveLength(3);
        expect(reg.getBySource('bundled')).toHaveLength(2);
        expect(reg.getBySource('workspace')).toHaveLength(1);
    });

    it('parse → register → retrieve → verify metadata intact', () => {
        const reg = new SkillRegistry();

        const content = `---
name: advanced-skill
description: An advanced skill with many features
user-invocable: true
command-dispatch: tool
command-tool: run_advanced
---
## Usage
Use this skill for advanced operations.`;

        const parsed = parseSkillContent(content, '/skills/advanced/SKILL.md');
        expect(parsed).not.toBeNull();

        const entry: SkillEntry = {
            id: parsed!.meta.name,
            source: 'workspace',
            baseDir: '/skills/advanced',
            markdownPath: parsed!.filePath,
            instructions: parsed!.instructions,
            metadata: {
                name: parsed!.meta.name,
                description: parsed!.meta.description,
                events: [],
            },
        };
        reg.register(entry);

        // Verify
        const retrieved = reg.getById('advanced-skill');
        expect(retrieved).toBeDefined();
        expect(retrieved?.metadata.description).toBe('An advanced skill with many features');
    });

    it('invalid SKILL.md rejected → registry unchanged', () => {
        const reg = new SkillRegistry();

        // Invalid: no frontmatter
        const bad1 = parseSkillContent('Just markdown, no frontmatter');
        expect(bad1).toBeNull();

        // Invalid: no name
        const bad2 = parseSkillContent('---\ndescription: no name\n---\nBody');
        expect(bad2).toBeNull();

        // Registry should be empty
        expect(reg.list()).toHaveLength(0);
    });
});
