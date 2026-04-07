/**
 * markdown/whatsapp.test.ts — WhatsApp MD conversion tests
 */
import { describe, it, expect } from 'vitest';
import { markdownToWhatsApp, whatsAppToMarkdown, stripWhatsAppFormatting } from './whatsapp.js';

describe('WhatsApp Markdown', () => {
    describe('markdownToWhatsApp', () => {
        it('converts bold', () => {
            const result = markdownToWhatsApp('**bold text**');
            expect(result).toContain('*');
        });

        it('converts italic', () => {
            const result = markdownToWhatsApp('*italic*');
            expect(result).toContain('_');
        });
    });

    describe('whatsAppToMarkdown', () => {
        it('converts bold', () => {
            const result = whatsAppToMarkdown('*bold*');
            expect(result).toContain('**bold**');
        });

        it('converts italic', () => {
            const result = whatsAppToMarkdown('_italic_');
            expect(result).toContain('*italic*');
        });

        it('converts strikethrough', () => {
            const result = whatsAppToMarkdown('~deleted~');
            expect(result).toContain('~~deleted~~');
        });
    });

    describe('stripWhatsAppFormatting', () => {
        it('strips bold', () => expect(stripWhatsAppFormatting('*bold*')).toBe('bold'));
        it('strips italic', () => expect(stripWhatsAppFormatting('_italic_')).toBe('italic'));
        it('strips strikethrough', () => expect(stripWhatsAppFormatting('~deleted~')).toBe('deleted'));
        it('strips code', () => expect(stripWhatsAppFormatting('```code```')).toBe('code'));
        it('plain text unchanged', () => expect(stripWhatsAppFormatting('hello')).toBe('hello'));
    });
});
