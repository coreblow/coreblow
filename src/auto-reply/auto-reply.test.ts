// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { chunkMessage, chunkMessageSmart, containsOpenCodeBlock } from './chunk.js';
import { parseDirectives, stripDirectives, hasDirectives, parseSlashDirectives } from './reply/directive-parser.js';
import { generateTopicLabel, extractKeywords, categorizeConversation } from './reply/auto-topic.js';

describe('Auto-Reply — Phase 8', () => {

    // ─── Message Chunking ──────────────────────────────────────

    describe('chunkMessage', () => {
        it('returns single chunk for short message', () => {
            expect(chunkMessage('hello world')).toEqual(['hello world']);
        });

        it('splits long message at paragraph boundary', () => {
            const text = 'A'.repeat(1000) + '\n\n' + 'B'.repeat(1000) + '\n\n' + 'C'.repeat(1000);
            const chunks = chunkMessage(text, 'discord'); // 2000 limit
            expect(chunks.length).toBeGreaterThan(1);
        });

        it('uses platform-specific limits', () => {
            const text = 'x'.repeat(3000);
            const discordChunks = chunkMessage(text, 'discord'); // 2000
            const telegramChunks = chunkMessage(text, 'telegram'); // 4096
            expect(discordChunks.length).toBeGreaterThan(telegramChunks.length);
        });

        it('defaults to 4096 for unknown platform', () => {
            const text = 'x'.repeat(5000);
            const chunks = chunkMessage(text, 'unknown-platform');
            expect(chunks.length).toBe(2);
        });

        it('splits at word boundary, not mid-word', () => {
            const words = Array(500).fill('hello').join(' '); // many words
            const chunks = chunkMessage(words, 'discord');
            for (const chunk of chunks) {
                expect(chunk.endsWith('o') || chunk.endsWith('hello')).toBe(true);
            }
        });
    });

    describe('containsOpenCodeBlock', () => {
        it('detects open code block', () => {
            expect(containsOpenCodeBlock('```python\ncode here')).toBe(true);
        });

        it('returns false for balanced blocks', () => {
            expect(containsOpenCodeBlock('```\ncode\n```')).toBe(false);
        });

        it('returns false for no blocks', () => {
            expect(containsOpenCodeBlock('no code here')).toBe(false);
        });
    });

    describe('chunkMessageSmart', () => {
        it('preserves short message', () => {
            expect(chunkMessageSmart('short')).toEqual(['short']);
        });

        it('closes open code blocks at chunk boundaries', () => {
            const text = '```python\n' + 'x = 1\n'.repeat(500) + '```';
            const chunks = chunkMessageSmart(text, 'discord');
            // Each chunk with open code block should be closed
            for (const chunk of chunks) {
                expect(containsOpenCodeBlock(chunk)).toBe(false);
            }
        });
    });

    // ─── Directive Parser ──────────────────────────────────────

    describe('parseDirectives', () => {
        it('parses @model directive', () => {
            const directives = parseDirectives('Hello @model gpt-4o please help');
            expect(directives).toHaveLength(1);
            expect(directives[0]!.type).toBe('model');
            expect(directives[0]!.value).toBe('gpt-4o');
        });

        it('parses @temperature directive', () => {
            const directives = parseDirectives('@temp 0.5 be creative');
            expect(directives[0]!.type).toBe('temperature');
            expect(directives[0]!.value).toBe('0.5');
        });

        it('parses @system directive with quotes', () => {
            const directives = parseDirectives('@system "You are a pirate" hello');
            expect(directives[0]!.type).toBe('system');
            expect(directives[0]!.value).toBe('You are a pirate');
        });

        it('parses @persona', () => {
            const directives = parseDirectives('@persona coder help me');
            expect(directives[0]!.value).toBe('coder');
        });

        it('parses @reset', () => {
            const directives = parseDirectives('@reset');
            expect(directives[0]!.type).toBe('reset');
        });

        it('parses multiple directives', () => {
            const directives = parseDirectives('@model claude @temp 0.3 write code');
            expect(directives).toHaveLength(2);
        });

        it('returns empty for no directives', () => {
            expect(parseDirectives('just a normal message')).toEqual([]);
        });
    });

    describe('stripDirectives', () => {
        it('removes directives from text', () => {
            const clean = stripDirectives('Hello @model gpt-4o please help');
            expect(clean).toBe('Hello please help');
            expect(clean).not.toContain('@model');
        });

        it('returns unchanged text without directives', () => {
            expect(stripDirectives('normal text')).toBe('normal text');
        });
    });

    describe('hasDirectives', () => {
        it('detects directives', () => {
            expect(hasDirectives('@model gpt-4')).toBe(true);
            expect(hasDirectives('@reset')).toBe(true);
        });

        it('returns false without directives', () => {
            expect(hasDirectives('normal text')).toBe(false);
        });
    });

    describe('parseSlashDirectives', () => {
        it('parses /model command', () => {
            const dirs = parseSlashDirectives('/model claude-opus-4-6');
            expect(dirs[0]!.type).toBe('model');
            expect(dirs[0]!.value).toBe('claude-opus-4-6');
        });

        it('parses /reset', () => {
            const dirs = parseSlashDirectives('/reset');
            expect(dirs[0]!.type).toBe('reset');
        });

        it('ignores non-slash text', () => {
            expect(parseSlashDirectives('hello world')).toEqual([]);
        });
    });

    // ─── Auto-Topic ────────────────────────────────────────────

    describe('generateTopicLabel', () => {
        it('returns first user message if short', () => {
            const label = generateTopicLabel([{ role: 'user', content: 'How to sort arrays?' }]);
            expect(label).toBe('How to sort arrays?');
        });

        it('truncates long messages', () => {
            const label = generateTopicLabel([{ role: 'user', content: 'x'.repeat(200) }]);
            expect(label.length).toBeLessThanOrEqual(55);
        });

        it('returns default for empty', () => {
            expect(generateTopicLabel([])).toBe('New Conversation');
        });
    });

    describe('extractKeywords', () => {
        it('extracts top keywords', () => {
            const keywords = extractKeywords('TypeScript error in function call when parsing JSON data');
            expect(keywords).toContain('typescript');
            expect(keywords).toContain('error');
            expect(keywords.length).toBeLessThanOrEqual(5);
        });

        it('filters stop words', () => {
            const keywords = extractKeywords('the quick brown fox jumps over the lazy dog');
            expect(keywords).not.toContain('the');
            expect(keywords).not.toContain('and');
        });
    });

    describe('categorizeConversation', () => {
        it('detects coding conversation', () => {
            const cat = categorizeConversation([
                { role: 'user', content: 'I have a bug in my TypeScript function, debug this code please' },
            ]);
            expect(cat).toBe('coding');
        });

        it('detects writing conversation', () => {
            const cat = categorizeConversation([
                { role: 'user', content: 'Write an article about space exploration and edit the draft' },
            ]);
            expect(cat).toBe('writing');
        });

        it('defaults to general', () => {
            const cat = categorizeConversation([{ role: 'user', content: 'Hello there' }]);
            expect(cat).toBe('general');
        });
    });
});
