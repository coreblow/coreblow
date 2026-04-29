import { describe, it, expect } from 'vitest';
import { parseSkillContent, type ParsedSkill } from './parser.js';
import type { SkillMetadata, SkillEntry, SkillContext } from './types.js';
import { hasBinary } from './status.js';

// ─── parseSkillContent ──────────────────────────────────────────

describe('parseSkillContent', () => {
    it('parses a valid SKILL.md with frontmatter', () => {
        const content = `---
name: test-skill
description: A test skill
---
This is the instruction body.
`;
        const result = parseSkillContent(content, '/skills/test/SKILL.md');
        expect(result).not.toBeNull();
        expect(result!.meta.name).toBe('test-skill');
        expect(result!.meta.description).toBe('A test skill');
        expect(result!.instructions).toBe('This is the instruction body.');
        expect(result!.filePath).toBe('/skills/test/SKILL.md');
    });

    it('returns null for content without frontmatter', () => {
        const result = parseSkillContent('Just plain text');
        expect(result).toBeNull();
    });

    it('returns null when name is missing', () => {
        const content = `---
description: no name
---
body
`;
        const result = parseSkillContent(content);
        expect(result).toBeNull();
    });

    it('parses boolean values', () => {
        const content = `---
name: bool-test
description: test
user-invocable: true
disable-model-invocation: false
---
body
`;
        const result = parseSkillContent(content)!;
        expect(result.meta['user-invocable']).toBe(true);
        expect(result.meta['disable-model-invocation']).toBe(false);
    });

    it('parses numeric values', () => {
        const content = `---
name: num-test
description: test
priority: 42
---
body
`;
        const result = parseSkillContent(content)!;
        expect((result.meta as any).priority).toBe(42);
    });

    it('parses quoted strings', () => {
        const content = `---
name: "quoted-name"
description: 'quoted desc'
---
body
`;
        const result = parseSkillContent(content)!;
        expect(result.meta.name).toBe('quoted-name');
        expect(result.meta.description).toBe('quoted desc');
    });

    it('parses command-dispatch and command-tool', () => {
        const content = `---
name: cmd-skill
description: dispatch skill
command-dispatch: tool
command-tool: my-tool
---
instructions
`;
        const result = parseSkillContent(content)!;
        expect(result.meta['command-dispatch']).toBe('tool');
        expect(result.meta['command-tool']).toBe('my-tool');
    });

    it('parses nested map metadata', () => {
        const content = `---
name: map-test
description: test
metadata:
  author: coreblow
  version: 1
---
body
`;
        const result = parseSkillContent(content)!;
        expect(result.meta.metadata).toBeDefined();
        expect(result.meta.metadata!.author).toBe('coreblow');
        expect(result.meta.metadata!.version).toBe(1);
    });

    it('trims instruction body', () => {
        const content = `---
name: trim-test
description: test
---

  lots of whitespace body

`;
        const result = parseSkillContent(content)!;
        expect(result.instructions).toBe('lots of whitespace body');
    });

    it('sets dirPath from filePath', () => {
        const result = parseSkillContent(`---\nname: x\ndescription: y\n---\nbody`, '/a/b/SKILL.md')!;
        expect(result.dirPath).toBe('/a/b');
    });
});

// ─── hasBinary ──────────────────────────────────────────────────

describe('hasBinary', () => {
    it('returns true for common binary (node)', () => {
        expect(hasBinary('node')).toBe(true);
    });

    it('returns false for nonexistent binary', () => {
        expect(hasBinary('nonexistent-binary-xyz-42')).toBe(false);
    });
});

// ─── types — structural validation ─────────────────────────────

describe('types — structural validation', () => {
    it('SkillMetadata has correct shape', () => {
        const meta: SkillMetadata = {
            name: 'test',
            description: 'A skill',
            events: ['message'],
            handler: './handler.js',
            export: 'default',
            always: false,
            os: ['darwin'],
            requires: ['git'],
            emoji: '🔧',
        };
        expect(meta.name).toBe('test');
        expect(meta.events).toEqual(['message']);
        expect(meta.os).toContain('darwin');
    });

    it('SkillEntry has correct shape', () => {
        const entry: SkillEntry = {
            id: 'my-skill',
            baseDir: '/skills/my-skill',
            markdownPath: '/skills/my-skill/SKILL.md',
            instructions: 'Do things',
            metadata: { name: 'my-skill', description: 'test' },
            source: 'bundled',
        };
        expect(entry.source).toBe('bundled');
        expect(entry.id).toBe('my-skill');
    });

    it('SkillContext has correct shape', () => {
        const ctx: SkillContext = {
            event: 'message',
            input: 'hello',
            sessionId: 'sess-1',
            extra: { key: 'value' },
        };
        expect(ctx.event).toBe('message');
        expect(ctx.extra?.key).toBe('value');
    });

    it('source must be valid', () => {
        const sources: SkillEntry['source'][] = ['bundled', 'workspace', 'remote'];
        for (const src of sources) {
            const e: SkillEntry = {
                id: 'x', baseDir: '', markdownPath: '', instructions: '',
                metadata: { name: '', description: '' }, source: src,
            };
            expect(e.source).toBe(src);
        }
    });
});
