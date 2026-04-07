import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { discoverSkills, parseFrontmatter } from '../../src/skills/loader.js';

// Mock fs for file-based tests
vi.mock('node:fs', async () => {
    const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
    return { ...actual };
});

describe('skills/loader', () => {
    describe('parseFrontmatter', () => {
        it('parses standard YAML frontmatter', () => {
            const content = `---
name: Test Skill
description: Does cool stuff
emoji: 🔥
---
# Instructions
Do something`;

            const { metadata, body } = parseFrontmatter(content);
            expect(metadata.name).toBe('Test Skill');
            expect(metadata.description).toBe('Does cool stuff');
            expect(metadata.emoji).toBe('🔥');
            expect(body).toContain('# Instructions');
        });

        it('parses boolean values', () => {
            const content = `---
name: Test
always: true
---
body`;
            const { metadata } = parseFrontmatter(content);
            expect(metadata.always).toBe(true);
        });

        it('parses numeric values', () => {
            const content = `---
name: Test
priority: 42
---
body`;
            const { metadata } = parseFrontmatter(content);
            expect(metadata.priority).toBe(42);
        });

        it('parses inline array values', () => {
            const content = `---
name: Test
events: [message, tool-call]
---
body`;
            const { metadata } = parseFrontmatter(content);
            expect(metadata.events).toEqual(['message', 'tool-call']);
        });

        it('parses YAML list values', () => {
            const content = `---
name: Test
os:
- darwin
- linux
---
body`;
            const { metadata } = parseFrontmatter(content);
            expect(metadata.os).toEqual(['darwin', 'linux']);
        });

        it('returns empty metadata + full body when no frontmatter', () => {
            const content = 'Just a regular markdown file';
            const { metadata, body } = parseFrontmatter(content);
            expect(Object.keys(metadata)).toHaveLength(0);
            expect(body).toBe(content);
        });

        it('strips quotes from string values', () => {
            const content = `---
name: "Quoted Skill"
handler: 'handler.ts'
---
body`;
            const { metadata } = parseFrontmatter(content);
            expect(metadata.name).toBe('Quoted Skill');
            expect(metadata.handler).toBe('handler.ts');
        });
    });

    describe('discoverSkills', () => {
        it('returns empty array for non-existent directory', () => {
            const skills = discoverSkills('/nonexistent/path');
            expect(skills).toEqual([]);
        });

        it('discovers skills from a directory with SKILL.md files', () => {
            const tmpDir = path.join('/tmp', `skill-test-${Date.now()}`);
            const skillDir = path.join(tmpDir, 'my-skill');

            fs.mkdirSync(skillDir, { recursive: true });
            fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `---
name: My Skill
description: A test skill
---
# Instructions
Do the thing`);

            const skills = discoverSkills(tmpDir);
            expect(skills).toHaveLength(1);
            expect(skills[0].id).toBe('my-skill');
            expect(skills[0].metadata.name).toBe('My Skill');
            expect(skills[0].instructions).toContain('# Instructions');
            expect(skills[0].source).toBe('workspace');

            // Cleanup
            fs.rmSync(tmpDir, { recursive: true });
        });

        it('skips directories without SKILL.md', () => {
            const tmpDir = path.join('/tmp', `skill-test-${Date.now()}`);
            fs.mkdirSync(path.join(tmpDir, 'empty-dir'), { recursive: true });

            const skills = discoverSkills(tmpDir);
            expect(skills).toHaveLength(0);

            fs.rmSync(tmpDir, { recursive: true });
        });

        it('skips hidden directories', () => {
            const tmpDir = path.join('/tmp', `skill-test-${Date.now()}`);
            const hiddenDir = path.join(tmpDir, '.hidden-skill');
            fs.mkdirSync(hiddenDir, { recursive: true });
            fs.writeFileSync(path.join(hiddenDir, 'SKILL.md'), `---
name: Hidden
description: Should be skipped
---
body`);

            const skills = discoverSkills(tmpDir);
            expect(skills).toHaveLength(0);

            fs.rmSync(tmpDir, { recursive: true });
        });
    });
});
