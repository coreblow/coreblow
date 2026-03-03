import { describe, it, expect } from 'vitest';
import { normalizeContent, extractText, extractToolUses, extractThinking, countBlocksByType, text, toolUse, toolResult, hasToolUse, redactBlocks, type ContentBlock } from './content-blocks.js';

describe('Content Blocks', () => {
    describe('normalizeContent', () => {
        it('string → TextBlock[]', () => {
            const blocks = normalizeContent('hello');
            expect(blocks).toHaveLength(1);
            expect(blocks[0].type).toBe('text');
        });
        it('null → []', () => expect(normalizeContent(null)).toEqual([]));
        it('array passthrough', () => {
            const blocks: ContentBlock[] = [text('a')];
            expect(normalizeContent(blocks)).toBe(blocks);
        });
    });

    describe('extractText', () => {
        it('extracts text blocks', () => {
            const blocks: ContentBlock[] = [text('hello'), toolUse('1', 'read', {}), text('world')];
            expect(extractText(blocks)).toBe('hello\nworld');
        });
        it('empty for no text', () => {
            expect(extractText([toolUse('1', 'read', {})])).toBe('');
        });
    });

    describe('extractToolUses', () => {
        it('finds tool uses', () => {
            const blocks: ContentBlock[] = [text('x'), toolUse('1', 'read', { path: '/a' }), toolUse('2', 'write', { path: '/b' })];
            const uses = extractToolUses(blocks);
            expect(uses).toHaveLength(2);
            expect(uses[0].name).toBe('read');
        });
    });

    describe('extractThinking', () => {
        it('finds thinking blocks', () => {
            const blocks: ContentBlock[] = [{ type: 'thinking', thinking: 'reasoning...' }, text('answer')];
            expect(extractThinking(blocks)).toEqual(['reasoning...']);
        });
    });

    describe('countBlocksByType', () => {
        it('counts', () => {
            const blocks: ContentBlock[] = [text('a'), text('b'), toolUse('1', 'r', {})];
            const counts = countBlocksByType(blocks);
            expect(counts.text).toBe(2);
            expect(counts.tool_use).toBe(1);
        });
    });

    describe('builders', () => {
        it('text()', () => expect(text('hi')).toEqual({ type: 'text', text: 'hi' }));
        it('toolUse()', () => expect(toolUse('1', 'read', { a: 1 }).name).toBe('read'));
        it('toolResult()', () => {
            const r = toolResult('1', 'ok', false);
            expect(r.tool_use_id).toBe('1');
            expect(r.is_error).toBeUndefined();
        });
        it('toolResult error', () => expect(toolResult('1', 'err', true).is_error).toBe(true));
    });

    describe('hasToolUse', () => {
        it('true when present', () => expect(hasToolUse([toolUse('1', 'r', {})])).toBe(true));
        it('false when absent', () => expect(hasToolUse([text('hi')])).toBe(false));
    });

    describe('redactBlocks', () => {
        it('redacts matching blocks', () => {
            const blocks: ContentBlock[] = [text('secret'), text('public')];
            const result = redactBlocks(blocks, (b) => b.type === 'text' && (b as any).text === 'secret');
            expect(result[0].type).toBe('redacted');
            expect(result[1].type).toBe('text');
        });
    });
});
