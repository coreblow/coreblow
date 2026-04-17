/**
 * media-understanding/document-parser.test.ts — Document parser tests
 */
import { describe, it, expect } from 'vitest';
import { parseTextDocument } from './document-parser.js';

describe('Document Parser', () => {
    it('should parse title from first line', () => {
        const doc = parseTextDocument('My Title\nSome content');
        expect(doc.title).toBe('My Title');
    });

    it('should parse sections', () => {
        const doc = parseTextDocument('Title\n# Section 1\nContent 1\n# Section 2\nContent 2');
        expect(doc.sections).toHaveLength(2);
        expect(doc.sections[0].heading).toBe('Section 1');
    });

    it('should handle empty input', () => {
        const doc = parseTextDocument('');
        expect(doc.title).toBeDefined();
    });
});
