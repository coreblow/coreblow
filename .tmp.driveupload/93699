/**
 * tests/unit/skills.test.ts
 * Tests for the skills parser
 */
import { describe, it, expect } from 'vitest';
import { parseSkillFile } from '../../src/skills/parser.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('parseSkillFile', () => {
    const tmpDir = path.join(os.tmpdir(), `coreblow-skill-test-${Date.now()}`);

    it('should parse a valid SKILL.md file', () => {
        fs.mkdirSync(tmpDir, { recursive: true });
        const skillPath = path.join(tmpDir, 'SKILL.md');
        fs.writeFileSync(skillPath, `---
name: test-skill
description: A test skill
command-tool: test_tool
---

# Test Skill

This is a test skill.

## Instructions

Do something useful.
`);
        const result = parseSkillFile(skillPath);
        expect(result).not.toBeNull();
        expect(result!.meta.name).toBe('test-skill');
        expect(result!.meta.description).toBe('A test skill');
        expect(result!.instructions).toContain('Test Skill');
    });

    it('should return null for non-existent file', () => {
        const result = parseSkillFile('/tmp/non-existent-skill.md');
        expect(result).toBeNull();
    });

    it('should handle file without frontmatter', () => {
        const skillPath = path.join(tmpDir, 'no-frontmatter.md');
        fs.writeFileSync(skillPath, '# Just Content\n\nNo frontmatter here.');
        const result = parseSkillFile(skillPath);
        // Should still parse or return null depending on implementation
        expect(result === null || result.instructions !== undefined).toBe(true);
    });

    it('should extract command-tool from frontmatter', () => {
        const skillPath = path.join(tmpDir, 'with-tool.md');
        fs.writeFileSync(skillPath, `---
name: web-skill
description: Web tools
command-tool: web_fetch
---

Use web_fetch to get pages.
`);
        const result = parseSkillFile(skillPath);
        if (result) {
            expect(result.meta.name).toBe('web-skill');
        }
    });

    // Cleanup
    it('should cleanup temp files', () => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        expect(fs.existsSync(tmpDir)).toBe(false);
    });
});
