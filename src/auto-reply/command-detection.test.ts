import { describe, it, expect } from 'vitest';
import { hasInlineCommandTokens } from './command-detection.js';

describe('hasInlineCommandTokens', () => {
    it('detects /command at start of text', () => {
        expect(hasInlineCommandTokens('/status')).toBe(true);
        expect(hasInlineCommandTokens('/help me')).toBe(true);
    });

    it('detects /command after whitespace', () => {
        expect(hasInlineCommandTokens('hey /status')).toBe(true);
        expect(hasInlineCommandTokens('please run /help now')).toBe(true);
    });

    it('detects !command', () => {
        expect(hasInlineCommandTokens('!help')).toBe(true);
        expect(hasInlineCommandTokens('hey !status')).toBe(true);
    });

    it('rejects empty/whitespace', () => {
        expect(hasInlineCommandTokens('')).toBe(false);
        expect(hasInlineCommandTokens('  ')).toBe(false);
        expect(hasInlineCommandTokens(undefined)).toBe(false);
    });

    it('rejects plain text without commands', () => {
        expect(hasInlineCommandTokens('hello world')).toBe(false);
        expect(hasInlineCommandTokens('just a normal message')).toBe(false);
    });

    it('rejects slash not followed by alpha', () => {
        expect(hasInlineCommandTokens('1/2')).toBe(false);
        expect(hasInlineCommandTokens('a/b')).toBe(false); // no space before /
    });

    it('rejects URLs that look like commands', () => {
        // URL path segments have / but not after whitespace typically
        expect(hasInlineCommandTokens('https://example.com')).toBe(false);
    });
});
