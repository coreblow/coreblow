/**
 * Wave 40: Reply Pipeline I
 * Tests for directive parsing, applying directives, output normalization, and deduplication.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
    parseDirectives, 
    stripDirectives, 
    hasDirectives, 
    parseSlashDirectives 
} from '../../src/auto-reply/reply/directive-parser.js';
import { 
    applyDirectives, 
    validateDirectivePermissions,
    type ReplyContext
} from '../../src/auto-reply/reply/directive-handler.js';
import { 
    stripThinkingTags, 
    stripAssistantPrefix, 
    stripMarkdown, 
    normalizeReply, 
    truncateReply 
} from '../../src/auto-reply/reply/normalize-reply.js';
import { 
    deduplicateReply, 
    isFuzzyDuplicate, 
    clearDedupCache 
} from '../../src/auto-reply/reply/reply-dedup.js';

describe('Wave 40: Reply Pipeline I', () => {

    describe('Directive Parser (directive-parser.ts)', () => {
        it('parseDirectives extracts singular @model directive', () => {
            const text = 'Hello @model gpt-4o some more text';
            const directives = parseDirectives(text);
            expect(directives).toHaveLength(1);
            expect(directives[0].type).toBe('model');
            expect(directives[0].value).toBe('gpt-4o');
        });

        it('parseDirectives extracts singular @temp directive', () => {
            const text = 'Let uses @temp 0.9 for creativity';
            const directives = parseDirectives(text);
            expect(directives).toHaveLength(1);
            expect(directives[0].type).toBe('temperature');
            expect(directives[0].value).toBe('0.9');
            
            // Should also support @temperature
            const text2 = '@temperature 1.2';
            const directives2 = parseDirectives(text2);
            expect(directives2[0].value).toBe('1.2');
        });

        it('parseDirectives extracts multiple directives correctly', () => {
            const text = 'Hi @model claude-3 @compact on @temp 0.1 end';
            const directives = parseDirectives(text);
            expect(directives).toHaveLength(3);
            const types = directives.map(d => d.type);
            expect(types).toContain('model');
            expect(types).toContain('compact');
            expect(types).toContain('temperature');
        });

        it('parseDirectives parses quoted @system directive', () => {
            const text = '@system "Be a helpful bot" Please answer me';
            const directives = parseDirectives(text);
            expect(directives).toHaveLength(1);
            expect(directives[0].type).toBe('system');
            expect(directives[0].value).toBe('Be a helpful bot');
        });

        it('stripDirectives removes all recognized directives and trims space', () => {
            const text = '  @model gpt-4   @compact on   What is 2+2?  ';
            const clean = stripDirectives(text);
            expect(clean).toBe('What is 2+2?');
        });

        it('hasDirectives returns true only if directives exist', () => {
            expect(hasDirectives('Hello @model a')).toBe(true);
            expect(hasDirectives('@reset')).toBe(true);
            expect(hasDirectives('Just a normal message')).toBe(false);
            expect(hasDirectives('My email is user@model.com')).toBe(false); // Valid string without valid directive syntax
        });

        it('parseSlashDirectives extracts slash commands that act as directives', () => {
            const text = '/model claude-3';
            const directives = parseSlashDirectives(text);
            expect(directives).toHaveLength(1);
            expect(directives[0].type).toBe('model');
            expect(directives[0].value).toBe('claude-3');
        });

        it('parseSlashDirectives ignores slash commands not at the start', () => {
            const text = 'Hello /model claude-3';
            const directives = parseSlashDirectives(text);
            expect(directives).toHaveLength(0);
        });
    });

    describe('Directive Handler (directive-handler.ts)', () => {
        it('applyDirectives overrides default context values', () => {
            const directives = parseDirectives('@model gpt-4-turbo @temp 0.1 @style brief @compact on @reset');
            const initialCtx: Partial<ReplyContext> = {};
            const ctx = applyDirectives(directives, initialCtx);
            
            expect(ctx.model).toBe('gpt-4-turbo');
            expect(ctx.temperature).toBe(0.1);
            expect(ctx.style).toBe('brief');
            expect(ctx.compact).toBe(true);
            expect(ctx.shouldReset).toBe(true);
        });

        it('applyDirectives preserves existing values if not overriden', () => {
            const directives = parseDirectives('@temp 0.5'); // Only set temp
            const initialCtx = { model: 'llama-3', temperature: 0.1 };
            const ctx = applyDirectives(directives, initialCtx);
            
            expect(ctx.model).toBe('llama-3'); // Preserved
            expect(ctx.temperature).toBe(0.5); // Overridden
        });

        it('applyDirectives enforces temperature bounds (0 to 2)', () => {
            const d1 = parseDirectives('@temp 2.5'); // Invalid
            const d2 = parseDirectives('@temp -0.5'); // Invalid
            
            let ctx = applyDirectives(d1, { temperature: 0.7 });
            expect(ctx.temperature).toBe(0.7); // Remains unchanged
            
            ctx = applyDirectives(d2, { temperature: 0.7 });
            expect(ctx.temperature).toBe(0.7); // Remains unchanged
        });

        it('validateDirectivePermissions restricts admin-only directives', () => {
            const text = '@model gpt-4 @reset @system "X" @max_tokens 100 @temp 1.0';
            const directives = parseDirectives(text);
            
            // 'user' level
            const { allowed: allowedUser, denied: deniedUser } = validateDirectivePermissions(directives, 'user');
            expect(allowedUser.map(d => d.type)).toEqual(['model', 'temperature']);
            expect(deniedUser.map(d => d.type)).toEqual(['system', 'max_tokens', 'reset']);
            
            // 'admin' level
            const { allowed: allowedAdmin, denied: deniedAdmin } = validateDirectivePermissions(directives, 'admin');
            expect(deniedAdmin).toHaveLength(0);
            expect(allowedAdmin).toHaveLength(5);
        });
    });

    describe('Normalize Reply (normalize-reply.ts)', () => {
        it('stripThinkingTags removes <thinking> blocks', () => {
            const input = '<thinking>\nProcessing...\n</thinking>\nHello there!';
            expect(stripThinkingTags(input)).toBe('Hello there!');
        });

        it('stripAssistantPrefix removes Bot: and Assistant: prefixes', () => {
            expect(stripAssistantPrefix('Assistant: Hi')).toBe('Hi');
            expect(stripAssistantPrefix('Bot: Hi')).toBe('Hi');
            expect(stripAssistantPrefix('AI:  Hi')).toBe('Hi');
            expect(stripAssistantPrefix('CoreBlow: Hi')).toBe('Hi');
            expect(stripAssistantPrefix('NotBot: Hi')).toBe('NotBot: Hi');
        });

        it('stripMarkdown formats text to plain text', () => {
            const input = '# Header\nThis is **bold** and *italic* with ~~strike~~ and `code`.\n- item 1\n- item 2\n[Link](url)';
            const output = stripMarkdown(input);
            expect(output).toContain('This is bold and italic with strike and code.');
            expect(output).toContain('• item 1');
            expect(output).toContain('Link');
            expect(output).not.toContain('**');
            expect(output).not.toContain('#');
        });

        it('normalizeReply formats for discord natively', () => {
            const input = 'Assistant: <thinking>hm</thinking> **Bold**';
            const out = normalizeReply(input, 'discord');
            expect(out).toBe('**Bold**');
        });

        it('normalizeReply strips markdown for whatsapp', () => {
            const input = 'Assistant: **Bold**';
            const out = normalizeReply(input, 'whatsapp');
            expect(out).toBe('Bold');
            
            const outSms = normalizeReply(input, 'sms');
            expect(outSms).toBe('Bold');
        });

        it('normalizeReply converts standard markdown to mrkdwn for slack', () => {
            const input = 'This is **bold** and *italic*';
            const out = normalizeReply(input, 'slack');
            expect(out).toBe('This is _bold_ and _italic_');
        });

        it('truncateReply safely cuts strings and adds ellipsis', () => {
            const input = '1234567890';
            const short = truncateReply(input, 8);
            expect(short).toBe('12345...');
            expect(short.length).toBe(8);
            
            // Should not truncate if within limit
            expect(truncateReply(input, 20)).toBe('1234567890');
        });
    });

    describe('Reply Deduplication (reply-dedup.ts)', () => {
        beforeEach(() => {
            clearDedupCache();
        });
        
        afterEach(() => {
            clearDedupCache();
        });

        it('deduplicateReply detects exact duplicates in same session', () => {
            const sid = 'sess-1';
            const content = 'This is the exact same text';
            
            const r1 = deduplicateReply(sid, content);
            expect(r1.isDuplicate).toBe(false);
            
            const r2 = deduplicateReply(sid, content);
            expect(r2.isDuplicate).toBe(true);
            expect(r2.originalHash).toBeDefined();
        });

        it('deduplicateReply ignores exact match in different sessions', () => {
            const content = 'Hello world';
            
            const r1 = deduplicateReply('sess-1', content);
            const r2 = deduplicateReply('sess-2', content);
            
            expect(r1.isDuplicate).toBe(false);
            expect(r2.isDuplicate).toBe(false); // Different session!
        });

        it('isFuzzyDuplicate returns true for identical strings', () => {
            expect(isFuzzyDuplicate('abc', 'abc')).toBe(true);
        });

        it('isFuzzyDuplicate handles empty strings', () => {
            expect(isFuzzyDuplicate('', '')).toBe(true);
        });

        it('isFuzzyDuplicate detects character overlap near identical', () => {
            // Note: the overlap algorithm calculates overlap of generic characters used
            // "Hello world!" vs "Hello world."
            expect(isFuzzyDuplicate('Hello world!', 'Hello world.', 0.8)).toBe(true);
        });

        it('isFuzzyDuplicate returns false for significantly different lengths', () => {
            expect(isFuzzyDuplicate('Short', 'A very long string that is totally different', 0.9)).toBe(false);
        });
    });
});
