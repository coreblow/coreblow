import { describe, it, expect } from 'vitest';
import { hasBinary } from './status.js';
import type { SkillStatusEntry, SkillStatusReport } from './status.js';

describe('hasBinary', () => {
    it('returns true for a common binary (node)', () => {
        expect(hasBinary('node')).toBe(true);
    });

    it('returns false for a nonexistent binary', () => {
        expect(hasBinary('coreblow-nonexistent-binary-xyz')).toBe(false);
    });
});

describe('SkillStatusEntry interface', () => {
    it('represents a skill status with all fields', () => {
        const entry: SkillStatusEntry = {
            id: 'test-skill',
            name: 'Test Skill',
            description: 'A test skill',
            source: 'bundled',
            events: ['message'],
            loadable: true,
            filePath: '/skills/test/SKILL.md',
        };
        expect(entry.loadable).toBe(true);
        expect(entry.missingRequirements).toBeUndefined();
    });

    it('includes missing requirements when not loadable', () => {
        const entry: SkillStatusEntry = {
            id: 'broken-skill',
            name: 'Broken',
            description: 'Needs unavailable binary',
            source: 'workspace',
            events: [],
            loadable: false,
            missingRequirements: ['Missing binary: ffmpeg'],
            filePath: '/ws/skills/broken/SKILL.md',
        };
        expect(entry.loadable).toBe(false);
        expect(entry.missingRequirements).toContain('Missing binary: ffmpeg');
    });
});

describe('SkillStatusReport interface', () => {
    it('represents a complete report', () => {
        const report: SkillStatusReport = {
            total: 3,
            bundled: 2,
            workspace: 1,
            remote: 0,
            loadable: 2,
            skills: [],
        };
        expect(report.total).toBe(3);
        expect(report.bundled + report.workspace + report.remote).toBe(report.total);
    });
});
