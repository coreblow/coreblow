import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { parseFrontmatter, discoverSkills } from './loader.js';
import { parseSkillContent, parseSkillFile } from './parser.js';
import { SkillRegistry, getSkillRegistry } from './registry.js';

vi.mock('node:fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('node:fs')>();
    return {
        ...actual,
        readFileSync: vi.fn(),
        existsSync: vi.fn(),
        readdirSync: vi.fn(),
    };
});

describe('Skills Module', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('loader.ts: parseFrontmatter', () => {
        it('parses valid yaml frontmatter', () => {
            const content = `---
name: Test Skill
description: Simple skill
list:
  - a
  - b
inline: [1, 2]
bool: true
num: 42
---
body content
`;
            const { metadata, body } = parseFrontmatter(content);
            expect(metadata).toEqual({
                name: 'Test Skill',
                description: 'Simple skill',
                list: ['a', 'b'],
                inline: ['1', '2'],
                bool: true,
                num: 42,
            });
            expect(body).toBe('body content');
        });

        it('returns empty metadata if no frontmatter', () => {
            const { metadata, body } = parseFrontmatter('just body');
            expect(metadata).toEqual({});
            expect(body).toBe('just body');
        });

        it('handles malformed yaml gracefully', () => {
            const { metadata, body } = parseFrontmatter('---\nmalformed\n---\nbody');
            expect(metadata).toEqual({});
            expect(body).toBe('body');
        });

        it('leaks key-value from malformed block with colon (known behavior)', () => {
            // A line containing ':' in a malformed frontmatter block will be
            // parsed as a key-value pair. This documents the actual behavior.
            const { metadata, body } = parseFrontmatter('---\nfoo: bar\nno-colon-line\n---\nbody');
            expect(metadata).toEqual({ foo: 'bar' });
            expect(body).toBe('body');
        });
    });

    describe('loader.ts: discoverSkills', () => {
        it('discovers skills in a directory', () => {
            vi.mocked(fs.readdirSync).mockReturnValue([
                { name: 'skill-1', isDirectory: () => true },
                { name: '.hidden', isDirectory: () => true },
                { name: 'file.txt', isDirectory: () => false },
            ] as any[]);

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue('---\nname: Skill 1\n---\nbody');

            const skills = discoverSkills('/workspace', 'workspace');
            expect(skills.length).toBe(1);
            expect(skills[0].id).toBe('skill-1');
            expect(skills[0].metadata.name).toBe('Skill 1');
            expect(skills[0].source).toBe('workspace');
        });

        it('handles fs errors gracefully', () => {
            vi.mocked(fs.readdirSync).mockImplementation(() => { throw new Error('Not found'); });
            const skills = discoverSkills('/invalid');
            expect(skills).toEqual([]);
        });
    });

    describe('parser.ts: parseSkillContent & parseSkillFile', () => {
        it('parseSkillContent handles valid content', () => {
            const content = `---\nname: Parsed\ndescription: Desc\n---\nBody`;
            const parsed = parseSkillContent(content, '/path/SKILL.md');
            expect(parsed).not.toBeNull();
            expect(parsed?.meta.name).toBe('Parsed');
            expect(parsed?.meta.description).toBe('Desc');
            expect(parsed?.instructions).toBe('Body');
            expect(parsed?.filePath).toBe('/path/SKILL.md');
            expect(parsed?.dirPath).toBe('/path'); // path.dirname behavior
        });

        it('parseSkillContent fails without name', () => {
            const parsed = parseSkillContent(`---\ndescription: Desc\n---\nBody`);
            expect(parsed).toBeNull();
        });

        it('parseSkillFile reads and parses successfully', () => {
            vi.mocked(fs.readFileSync).mockReturnValue('---\nname: FileSkill\n---\nbody file');
            const parsed = parseSkillFile('/path/to/SKILL.md');
            expect(parsed?.meta.name).toBe('FileSkill');
            expect(parsed?.instructions).toBe('body file');
        });

        it('parseSkillFile handles read error', () => {
            vi.mocked(fs.readFileSync).mockImplementation(() => { throw new Error('Cannot read'); });
            const parsed = parseSkillFile('/invalid/SKILL.md');
            expect(parsed).toBeNull();
        });
    });

    describe('registry.ts: SkillRegistry', () => {
        let registry: SkillRegistry;

        beforeEach(() => {
            registry = new SkillRegistry();
        });

        it('registers and retrieves skills', () => {
            registry.register({ id: 's1', metadata: { name: 's1' }, source: 'bundled' } as any);
            expect(registry.getById('s1')).toBeDefined();
            expect(registry.list().length).toBe(1);
            expect(registry.getBySource('bundled').length).toBe(1);
        });

        it('discovers and registers', async () => {
            vi.mocked(fs.readdirSync).mockReturnValue([
                { name: 'skill-2', isDirectory: () => true },
            ] as any[]);
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue('---\nname: Skill 2\n---\nbody');

            const count = await registry.discover('/workspace');
            expect(count).toBe(1);
            expect(registry.getById('skill-2')).toBeDefined();
        });

        it('unregisters and clears', () => {
            registry.register({ id: 's1' } as any);
            expect(registry.unregister('s1')).toBe(true);
            expect(registry.unregister('s1')).toBe(false);

            registry.register({ id: 's2' } as any);
            registry.clear();
            expect(registry.list().length).toBe(0);
        });

        it('singleton getSkillRegistry', () => {
            const r1 = getSkillRegistry();
            const r2 = getSkillRegistry();
            expect(r1).toBe(r2);
        });
    });
});
