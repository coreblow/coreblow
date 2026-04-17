// @ts-nocheck
/**
 * acp/event-mapper.test.ts — ACP event mapper tests
 */
import { describe, it, expect } from 'vitest';
import { extractTextFromPrompt, extractAttachments, inferToolKind } from './event-mapper.js';
import type { ContentBlock } from './types.js';

describe('ACP Event Mapper', () => {
    it('should extract text from prompt blocks', () => {
        const blocks: ContentBlock[] = [
            { type: 'text', text: 'Hello' },
            { type: 'text', text: ' World' },
        ];
        expect(extractTextFromPrompt(blocks)).toContain('Hello');
        expect(extractTextFromPrompt(blocks)).toContain('World');
    });

    it('should extract attachments', () => {
        const blocks: ContentBlock[] = [
            { type: 'text', text: 'Hi' },
            { type: 'image', data: 'base64data', mimeType: 'image/png' },
        ];
        const attachments = extractAttachments(blocks);
        expect(attachments.length).toBeGreaterThan(0);
    });

    it('should infer tool kind', () => {
        expect(inferToolKind('bash')).toBeDefined();
        expect(inferToolKind(undefined)).toBeDefined();
    });
});
