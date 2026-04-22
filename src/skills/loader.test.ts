/**
 * CoreBlow — Skill Loader Tests
 *
 * Tests for SKILL.md discovery, YAML frontmatter parsing,
 * metadata resolution, and directory scanning.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseFrontmatter, discoverSkills } from './loader.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('parseFrontmatter', () => {
    it('parses simple key-value frontmatter', () => {
        const input = `---
name: my-skill
description: Does something cool
---

# Instructions`;

        const { metadata, body } = parseFrontmatter(input);
        expect(metadata['name']).toBe('my-skill');
        expect(metadata['description']).toBe('Does something cool');
        expect(body).toContain('# Instructions');
    });

    it('parses boolean values', () => {
        const input = `---
always: true
hidden: false
---`;
        const { metadata } = parseFrontmatter(input);
        expect(metadata['always']).toBe(true);
        expect(metadata['hidden']).toBe(false);
    });

    it('parses numeric values', () => {
        const input = `---
priority: 42
weight: 3.14
---`;
        const { metadata } = parseFrontmatter(input);
        expect(metadata['priority']).toBe(42);
        expect(metadata['weight']).toBeCloseTo(3.14);
    });

    it('parses inline lists', () => {
        const input = `---
os: [darwin, linux]
---`;
        const { metadata } = parseFrontmatter(input);
        expect(metadata['os']).toEqual(['darwin', 'linux']);
    });

    it('parses multi-line lists', () => {
        const input = `---
events:
  - message
  - tool-call
---`;
        const { metadata } = parseFrontmatter(input);
        expect(metadata['events']).toEqual(['message', 'tool-call']);
    });

    it('strips quotes from values', () => {
        const input = `---
name: 'quoted-skill'
description: "double-quoted"
---`;
        const { metadata } = parseFrontmatter(input);
        expect(metadata['name']).toBe('quoted-skill');
        expect(metadata['description']).toBe('double-quoted');
    });

    it('returns empty metadata for no frontmatter', () => {
        const { metadata, body } = parseFrontmatter('# Just markdown');
        expect(metadata).toEqual({});
        expect(body).toBe('# Just markdown');
    });

    it('handles missing closing fence', () => {
        const { metadata, body } = parseFrontmatter('---\nname: broken\n');
        expect(metadata).toEqual({});
    });
});

describe('discoverSkills', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-skills-test-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('discovers skills from directory', () => {
        // Create a skill
        const skillDir = path.join(tmpDir, 'test-skill');
        fs.mkdirSync(skillDir);
        fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `---
name: test-skill
description: A test skill
---
# Test instructions`);

        const skills = discoverSkills(tmpDir);
        expect(skills).toHaveLength(1);
        expect(skills[0]!.id).toBe('test-skill');
        expect(skills[0]!.metadata.name).toBe('test-skill');
        expect(skills[0]!.instructions).toContain('# Test instructions');
    });

    it('skips directories without SKILL.md', () => {
        fs.mkdirSync(path.join(tmpDir, 'no-skill'));
        const skills = discoverSkills(tmpDir);
        expect(skills).toHaveLength(0);
    });

    it('skips hidden directories', () => {
        const hidden = path.join(tmpDir, '.hidden-skill');
        fs.mkdirSync(hidden);
        fs.writeFileSync(path.join(hidden, 'SKILL.md'), '---\nname: hidden\n---');
        const skills = discoverSkills(tmpDir);
        expect(skills).toHaveLength(0);
    });

    it('sets source correctly', () => {
        const skillDir = path.join(tmpDir, 'bundled-skill');
        fs.mkdirSync(skillDir);
        fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: bundled\n---');

        const skills = discoverSkills(tmpDir, 'bundled');
        expect(skills[0]!.source).toBe('bundled');
    });

    it('returns empty for non-existent directory', () => {
        expect(discoverSkills('/nonexistent/path')).toEqual([]);
    });

    it('parses emoji and requires from metadata', () => {
        const skillDir = path.join(tmpDir, 'rich-skill');
        fs.mkdirSync(skillDir);
        fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `---
name: rich
emoji: 🎵
requires: [spogo, spotify_player]
---`);

        const skills = discoverSkills(tmpDir);
        expect(skills[0]!.metadata.emoji).toBe('🎵');
        expect(skills[0]!.metadata.requires).toEqual(['spogo', 'spotify_player']);
    });
});
