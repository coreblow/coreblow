import { describe, it, expect } from 'vitest';
import { parseSkillFile, parseSkillContent } from '../../src/skills/parser.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('skills/parser', () => {
    describe('parseSkillContent', () => {
        it('parses valid SKILL.md content', () => {
            const content = `---
name: Test Skill
description: A useful skill
---
# Instructions
Follow these steps`;

            const result = parseSkillContent(content);
            expect(result).not.toBeNull();
            expect(result!.meta.name).toBe('Test Skill');
            expect(result!.meta.description).toBe('A useful skill');
            expect(result!.instructions).toContain('# Instructions');
        });

        it('returns null for missing frontmatter', () => {
            const result = parseSkillContent('Just text, no frontmatter');
            expect(result).toBeNull();
        });

        it('returns null for missing name', () => {
            const content = `---
description: no name
---
body`;
            const result = parseSkillContent(content);
            expect(result).toBeNull();
        });

        it('parses boolean values', () => {
            const content = `---
name: Test
user-invocable: true
disable-model-invocation: false
---
body`;
            const result = parseSkillContent(content);
            expect(result!.meta['user-invocable']).toBe(true);
            expect(result!.meta['disable-model-invocation']).toBe(false);
        });

        it('parses numeric values', () => {
            const content = `---
name: Test
description: test
priority: 42
---
body`;
            const result = parseSkillContent(content);
            expect((result!.meta as any).priority).toBe(42);
        });

        it('handles nested YAML maps', () => {
            const content = `---
name: Nested
description: test nested
metadata:
  version: 2
  author: tester
---
body`;
            const result = parseSkillContent(content);
            expect(result!.meta.metadata).toBeDefined();
            expect((result!.meta.metadata as any).version).toBe(2);
            expect((result!.meta.metadata as any).author).toBe('tester');
        });

        it('fills in dirPath from filePath', () => {
            const result = parseSkillContent(`---
name: Test
description: x
---
body`, '/skills/test/SKILL.md');
            expect(result!.dirPath).toBe('/skills/test');
        });
    });

    describe('parseSkillFile', () => {
        it('parses a real file from disk', () => {
            const tmpDir = path.join('/tmp', `parser-test-${Date.now()}`);
            fs.mkdirSync(tmpDir, { recursive: true });
            const filePath = path.join(tmpDir, 'SKILL.md');
            fs.writeFileSync(filePath, `---
name: Disk Skill
description: From disk
---
# Read me`);

            const result = parseSkillFile(filePath);
            expect(result).not.toBeNull();
            expect(result!.meta.name).toBe('Disk Skill');
            expect(result!.instructions).toContain('# Read me');

            fs.rmSync(tmpDir, { recursive: true });
        });

        it('returns null for non-existent file', () => {
            const result = parseSkillFile('/nonexistent/SKILL.md');
            expect(result).toBeNull();
        });
    });
});
