import { describe, it, expect } from 'vitest';
import {
    isToolDocBlockStart,
    summarizeToolDescriptionText,
    describeToolForVerbose,
} from './tool-description-summary.js';

describe('isToolDocBlockStart', () => {
    it('detects ACTIONS:', () => {
        expect(isToolDocBlockStart('ACTIONS:')).toBe(true);
    });

    it('detects JOB SCHEMA:', () => {
        expect(isToolDocBlockStart('JOB SCHEMA:')).toBe(true);
    });

    it('detects CRITICAL CONSTRAINTS:', () => {
        expect(isToolDocBlockStart('CRITICAL CONSTRAINTS:')).toBe(true);
    });

    it('detects long uppercase labels ending with colon', () => {
        expect(isToolDocBlockStart('CONFIGURATION OPTIONS:')).toBe(true);
    });

    it('rejects short labels', () => {
        expect(isToolDocBlockStart('NAME:')).toBe(false);
    });

    it('is case-insensitive (normalizes to upper)', () => {
        expect(isToolDocBlockStart('actions:')).toBe(true);
        expect(isToolDocBlockStart('Critical Constraints:')).toBe(true);
    });

    it('rejects mixed-case non-matching labels', () => {
        expect(isToolDocBlockStart('some text here')).toBe(false);
    });

    it('rejects empty', () => {
        expect(isToolDocBlockStart('')).toBe(false);
    });
});

describe('summarizeToolDescriptionText', () => {
    it('uses displaySummary when provided', () => {
        expect(summarizeToolDescriptionText({
            displaySummary: 'My tool summary',
            rawDescription: 'Ignored',
        })).toBe('My tool summary');
    });

    it('extracts first paragraph from raw description', () => {
        const result = summarizeToolDescriptionText({
            rawDescription: 'This is a search tool.\n\nACTIONS:\n- search\n- list',
        });
        expect(result).toBe('This is a search tool.');
    });

    it('returns "Tool" for empty description', () => {
        expect(summarizeToolDescriptionText({})).toBe('Tool');
        expect(summarizeToolDescriptionText({ rawDescription: '' })).toBe('Tool');
    });

    it('skips doc block headers', () => {
        const result = summarizeToolDescriptionText({
            rawDescription: 'ACTIONS:\n- search\n\nActual description here',
        });
        expect(result).toBe('Actual description here');
    });

    it('truncates long text', () => {
        const long = 'A'.repeat(200);
        const result = summarizeToolDescriptionText({ rawDescription: long });
        expect(result.length).toBeLessThanOrEqual(120);
        expect(result).toContain('...');
    });

    it('normalizes whitespace', () => {
        expect(summarizeToolDescriptionText({
            rawDescription: 'Hello   world   test',
        })).toBe('Hello world test');
    });

    it('skips JSON-like and list lines', () => {
        const result = summarizeToolDescriptionText({
            rawDescription: '{ "type": "object" }\n\nUseful tool description',
        });
        expect(result).toBe('Useful tool description');
    });
});

describe('describeToolForVerbose', () => {
    it('returns fallback for empty description', () => {
        expect(describeToolForVerbose({ fallback: 'No description' })).toBe('No description');
    });

    it('returns raw description text', () => {
        expect(describeToolForVerbose({
            rawDescription: 'Execute shell commands safely',
            fallback: 'N/A',
        })).toBe('Execute shell commands safely');
    });

    it('stops at doc block headers', () => {
        const result = describeToolForVerbose({
            rawDescription: 'Search the codebase.\n\nACTIONS:\n- find\n- grep',
            fallback: 'N/A',
        });
        expect(result).toBe('Search the codebase.');
        expect(result).not.toContain('ACTIONS');
    });

    it('truncates long descriptions', () => {
        const long = 'Word '.repeat(100);
        const result = describeToolForVerbose({ rawDescription: long, fallback: 'N/A', maxLen: 50 });
        expect(result.length).toBeLessThanOrEqual(50);
        expect(result).toContain('...');
    });
});
