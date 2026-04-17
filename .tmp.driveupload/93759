/**
 * CoreBlow Phase 37 — Auto-Reply Command Detection & Message Chunking Tests
 *
 * Layer 1 (Edge Cases):
 *   - isSlashCommand, parseSlashCommand, stripBotMention
 *   - chunkMessage, chunkMessageSmart, containsOpenCodeBlock
 */
import { describe, it, expect } from 'vitest';
import {
    isSlashCommand, parseSlashCommand, stripBotMention,
} from '../../src/auto-reply/command-detection.js';
import {
    chunkMessage, chunkMessageSmart, containsOpenCodeBlock,
} from '../../src/auto-reply/chunk.js';

// ================================================================
describe('CommandDetection — Extended', () => {
    it('should detect slash commands', () => {
        expect(isSlashCommand('/help')).toBe(true);
        expect(isSlashCommand('/status arg1')).toBe(true);
    });

    it('should reject non-commands', () => {
        expect(isSlashCommand('hello')).toBe(false);
        expect(isSlashCommand('// comment')).toBe(false); // double slash
        expect(isSlashCommand('/')).toBe(false); // just slash
    });

    it('should parse slash command with args', () => {
        const result = parseSlashCommand('/model gpt-4o --fast');
        expect(result).not.toBeNull();
        expect(result?.command).toBe('model');
        expect(result?.args).toContain('gpt-4o');
        expect(result?.args).toContain('--fast');
    });

    it('should return null for non-command', () => {
        expect(parseSlashCommand('not a command')).toBeNull();
    });

    it('should strip bot mentions', () => {
        expect(stripBotMention('hello @coreblow world')).toBe('hello world');
        expect(stripBotMention('@bot help me')).toBe('help me');
        expect(stripBotMention('no mention here')).toBe('no mention here');
    });
});

// ================================================================
describe('MessageChunking — Extended', () => {
    it('should return single chunk for short message', () => {
        const chunks = chunkMessage('Hello world', 'discord');
        expect(chunks).toHaveLength(1);
        expect(chunks[0]).toBe('Hello world');
    });

    it('should split long message into multiple chunks', () => {
        const longText = 'A'.repeat(5000);
        const chunks = chunkMessage(longText, 'discord'); // limit 2000
        expect(chunks.length).toBeGreaterThan(1);
        expect(chunks.every(c => c.length <= 2000)).toBe(true);
    });

    it('should respect different platform limits', () => {
        const text = 'X'.repeat(3000);
        const discordChunks = chunkMessage(text, 'discord'); // 2000
        const telegramChunks = chunkMessage(text, 'telegram'); // 4096
        expect(discordChunks.length).toBeGreaterThan(telegramChunks.length);
    });

    it('should detect open code blocks', () => {
        expect(containsOpenCodeBlock('```js\nconsole.log("hi")')).toBe(true);
        expect(containsOpenCodeBlock('```js\nconsole.log("hi")\n```')).toBe(false);
        expect(containsOpenCodeBlock('no code blocks')).toBe(false);
    });

    it('should smart-chunk avoiding code block splits', () => {
        const text = 'Before.\n\n```js\n' + 'x = 1;\n'.repeat(500) + '```\n\nAfter.';
        const chunks = chunkMessageSmart(text, 'discord');
        expect(chunks.length).toBeGreaterThan(1);
    });

    it('should use default platform for unknown', () => {
        const chunks = chunkMessage('test', 'unknown-platform');
        expect(chunks).toHaveLength(1);
    });
});
