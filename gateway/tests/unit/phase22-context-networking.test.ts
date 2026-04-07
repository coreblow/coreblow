/**
 * CoreBlow Phase 22 — Agent Context & Networking Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ContextManager } from '../../src/agents/context-manager.js';
import { ConversationExporter } from '../../src/agents/conversation-exporter.js';
import { AutoReplyEngine } from '../../src/agents/auto-reply.js';
import { CommandParser } from '../../src/cli/command-parser.js';

// ================================================================
// Context Manager Tests
// ================================================================
describe('ContextManager', () => {
    let ctx: ContextManager;
    beforeEach(() => { ctx = new ContextManager(1000, 200); });

    it('should add messages', () => {
        ctx.add('user', 'Hello');
        expect(ctx.count()).toBe(1);
    });

    it('should estimate tokens', () => {
        expect(ctx.estimateTokens('Hello world!')).toBe(3); // 12 chars / 4
    });

    it('should get messages', () => {
        ctx.add('system', 'You are helpful');
        ctx.add('user', 'Hi');
        const msgs = ctx.getMessages();
        expect(msgs).toHaveLength(2);
        expect(msgs[0]!.role).toBe('system');
    });

    it('should track stats', () => {
        ctx.add('system', 'System prompt here');
        ctx.add('user', 'User message');
        const stats = ctx.getStats();
        expect(stats.totalMessages).toBe(2);
        expect(stats.systemTokens).toBeGreaterThan(0);
    });

    it('should trim on overflow', () => {
        // maxTokens=1000, reserved=200, limit=800 tokens
        ctx.add('system', 'S'.repeat(400), 10); // 100 tokens, high priority
        ctx.add('user', 'U'.repeat(400), 1);     // 100 tokens, low priority
        ctx.add('user', 'X'.repeat(2800), 5);    // 700 tokens — triggers trim
        // Should have removed the low-priority message
        expect(ctx.getTotalTokens()).toBeLessThanOrEqual(800);
    });

    it('should compact messages', () => {
        ctx.add('system', 'System');
        ctx.add('user', 'Msg 1');
        ctx.add('assistant', 'Reply 1');
        ctx.add('user', 'Msg 2');
        ctx.add('assistant', 'Reply 2');
        ctx.compact('User asked about coding and got help.');
        expect(ctx.count()).toBeLessThanOrEqual(4); // system + summary + 2 recent
    });

    it('should clear history', () => {
        ctx.add('system', 'System');
        ctx.add('user', 'Msg');
        ctx.clearHistory();
        expect(ctx.count()).toBe(1); // Only system remains
    });

    it('should reset', () => {
        ctx.add('system', 'System');
        ctx.reset();
        expect(ctx.count()).toBe(0);
    });
});

// ================================================================
// Conversation Exporter Tests
// ================================================================
describe('ConversationExporter', () => {
    const exporter = new ConversationExporter();
    const messages = [
        { role: 'system' as const, content: 'You are helpful', timestamp: Date.now() - 5000 },
        { role: 'user' as const, content: 'Hi there', timestamp: Date.now() - 3000 },
        { role: 'assistant' as const, content: 'Hello! How can I help?', timestamp: Date.now() },
    ];

    it('should export to JSON', () => {
        const result = exporter.export(messages, { format: 'json' });
        expect(result.format).toBe('json');
        const parsed = JSON.parse(result.content);
        expect(parsed.messages).toHaveLength(3);
    });

    it('should export to Markdown', () => {
        const result = exporter.export(messages, { format: 'markdown', title: 'Test Chat' });
        expect(result.content).toContain('# Test Chat');
        expect(result.content).toContain('User');
    });

    it('should export to HTML', () => {
        const result = exporter.export(messages, { format: 'html' });
        expect(result.content).toContain('<!DOCTYPE html>');
        expect(result.content).toContain('message');
    });

    it('should export to text', () => {
        const result = exporter.export(messages, { format: 'text' });
        expect(result.content).toContain('[USER]');
        expect(result.content).toContain('[ASSISTANT]');
    });

    it('should filter system messages', () => {
        const result = exporter.export(messages, { format: 'json', includeSystem: false });
        const parsed = JSON.parse(result.content);
        expect(parsed.messages).toHaveLength(2);
    });

    it('should include timestamps', () => {
        const result = exporter.export(messages, { format: 'json', includeTimestamps: true });
        expect(result.content).toContain('timestamp');
    });
});

// ================================================================
// Auto-Reply Engine Tests
// ================================================================
describe('AutoReplyEngine', () => {
    let engine: AutoReplyEngine;
    beforeEach(() => { engine = new AutoReplyEngine(); });

    it('should have built-in rules', () => {
        expect(engine.count()).toBeGreaterThanOrEqual(3);
    });

    it('should match greeting', () => {
        const result = engine.process('hello!');
        expect(result.matched).toBe(true);
        expect(result.reply).toContain('Hello');
    });

    it('should match thanks', () => {
        const result = engine.process('thank you!');
        expect(result.matched).toBe(true);
        expect(result.reply).toContain('welcome');
    });

    it('should match bye', () => {
        const result = engine.process('goodbye');
        expect(result.matched).toBe(true);
        expect(result.reply).toContain('Goodbye');
    });

    it('should not match unrelated', () => {
        const result = engine.process('what is the weather?');
        expect(result.matched).toBe(false);
    });

    it('should add custom rules', () => {
        engine.addRule({ id: 'ping', name: 'Ping', pattern: /^ping$/i, reply: 'pong', enabled: true, priority: 10 });
        const result = engine.process('ping');
        expect(result.reply).toBe('pong');
    });

    it('should disable rules', () => {
        engine.setEnabled('greeting', false);
        const result = engine.process('hello');
        expect(result.ruleId).not.toBe('greeting');
    });

    it('should remove rules', () => {
        engine.removeRule('greeting');
        expect(engine.list().find((r) => r.id === 'greeting')).toBeUndefined();
    });
});

// ================================================================
// Command Parser Tests
// ================================================================
describe('CommandParser', () => {
    let parser: CommandParser;
    beforeEach(() => { parser = new CommandParser(); });

    it('should detect commands', () => {
        expect(parser.isCommand('/help')).toBe(true);
        expect(parser.isCommand('hello')).toBe(false);
    });

    it('should parse basic commands', () => {
        const cmd = parser.parse('/status');
        expect(cmd?.command).toBe('status');
    });

    it('should parse args', () => {
        const cmd = parser.parse('/persona coder');
        expect(cmd?.command).toBe('persona');
        expect(cmd?.args).toEqual(['coder']);
    });

    it('should parse long flags', () => {
        const cmd = parser.parse('/export --format=json');
        expect(cmd?.flags?.format).toBe('json');
    });

    it('should parse boolean flags', () => {
        const cmd = parser.parse('/config --verbose');
        expect(cmd?.flags?.verbose).toBe(true);
    });

    it('should resolve aliases', () => {
        const cmd = parser.parse('/q');
        expect(cmd?.command).toBe('quit');
    });

    it('should have 10 built-in commands', () => {
        expect(parser.count()).toBe(10);
    });

    it('should generate help', () => {
        const help = parser.generateHelp();
        expect(help).toContain('/help');
        expect(help).toContain('/quit');
    });

    it('should handle quoted args', () => {
        const cmd = parser.parse('/model "gpt-4o mini"');
        expect(cmd?.args).toEqual(['gpt-4o mini']);
    });

    it('should execute commands', async () => {
        const result = await parser.execute('/status');
        expect(result).toContain('status');
    });
});
