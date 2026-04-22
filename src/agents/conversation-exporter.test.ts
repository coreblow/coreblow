import { describe, it, expect } from 'vitest';
import { ConversationExporter, type ExportMessage } from './conversation-exporter.js';

const exporter = new ConversationExporter();

const MESSAGES: ExportMessage[] = [
    { role: 'system', content: 'You are helpful', timestamp: 1700000000000 },
    { role: 'user', content: 'Hello', timestamp: 1700000001000 },
    { role: 'assistant', content: 'Hi there!', timestamp: 1700000002000, metadata: { model: 'claude' } },
];

describe('ConversationExporter', () => {
    describe('JSON export', () => {
        it('exports valid JSON', () => {
            const result = exporter.export(MESSAGES, { format: 'json' });
            expect(result.format).toBe('json');
            expect(result.messageCount).toBe(3);
            const parsed = JSON.parse(result.content);
            expect(parsed.messages).toHaveLength(3);
        });

        it('includes title', () => {
            const result = exporter.export(MESSAGES, { format: 'json', title: 'Test Chat' });
            const parsed = JSON.parse(result.content);
            expect(parsed.title).toBe('Test Chat');
        });

        it('includes timestamps when opted in', () => {
            const result = exporter.export(MESSAGES, { format: 'json', includeTimestamps: true });
            const parsed = JSON.parse(result.content);
            expect(parsed.messages[0].timestamp).toBeDefined();
        });

        it('excludes timestamps by default', () => {
            const result = exporter.export(MESSAGES, { format: 'json' });
            const parsed = JSON.parse(result.content);
            expect(parsed.messages[0].timestamp).toBeUndefined();
        });

        it('includes metadata when opted in', () => {
            const result = exporter.export(MESSAGES, { format: 'json', includeMetadata: true });
            const parsed = JSON.parse(result.content);
            expect(parsed.messages[2].metadata).toEqual({ model: 'claude' });
        });
    });

    describe('Markdown export', () => {
        it('generates markdown headers', () => {
            const result = exporter.export(MESSAGES, { format: 'markdown' });
            expect(result.content).toContain('# CoreBlow Conversation');
            expect(result.content).toContain('### 👤 User');
            expect(result.content).toContain('### 🤖 Assistant');
        });

        it('includes custom title', () => {
            const result = exporter.export(MESSAGES, { format: 'markdown', title: 'My Chat' });
            expect(result.content).toContain('# My Chat');
        });
    });

    describe('HTML export', () => {
        it('generates valid HTML', () => {
            const result = exporter.export(MESSAGES, { format: 'html' });
            expect(result.content).toContain('<!DOCTYPE html>');
            expect(result.content).toContain('class="message user"');
            expect(result.content).toContain('class="message assistant"');
        });

        it('escapes HTML in content', () => {
            const msgs: ExportMessage[] = [
                { role: 'user', content: '<script>alert("xss")</script>', timestamp: 0 },
            ];
            const result = exporter.export(msgs, { format: 'html' });
            expect(result.content).not.toContain('<script>');
            expect(result.content).toContain('&lt;script&gt;');
        });
    });

    describe('Text export', () => {
        it('generates plain text', () => {
            const result = exporter.export(MESSAGES, { format: 'text' });
            expect(result.content).toContain('[USER]');
            expect(result.content).toContain('[ASSISTANT]');
            expect(result.content).toContain('Hello');
        });
    });

    describe('filtering', () => {
        it('excludes system messages when opted out', () => {
            const result = exporter.export(MESSAGES, { format: 'json', includeSystem: false });
            expect(result.messageCount).toBe(2);
            const parsed = JSON.parse(result.content);
            expect(parsed.messages.every((m: any) => m.role !== 'system')).toBe(true);
        });

        it('includes system messages by default', () => {
            const result = exporter.export(MESSAGES, { format: 'json' });
            expect(result.messageCount).toBe(3);
        });
    });

    describe('ExportResult', () => {
        it('includes exportedAt timestamp', () => {
            const before = Date.now();
            const result = exporter.export(MESSAGES, { format: 'text' });
            expect(result.exportedAt).toBeGreaterThanOrEqual(before);
        });
    });
});
