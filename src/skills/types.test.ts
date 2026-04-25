import { describe, it, expect } from 'vitest';
import type {
    SkillMetadata,
    SkillEntry,
    SkillHandler,
    SkillContext,
} from './types.js';

describe('SkillMetadata interface', () => {
    it('supports minimal required fields', () => {
        const meta: SkillMetadata = {
            name: 'Web Search',
            description: 'Search the web for information',
        };
        expect(meta.name).toBe('Web Search');
        expect(meta.description).toBeTruthy();
    });

    it('supports all optional fields', () => {
        const meta: SkillMetadata = {
            name: 'Browser',
            description: 'Control a browser',
            events: ['message', 'tool-call'],
            handler: './handler.js',
            export: 'handleBrowser',
            always: true,
            os: ['darwin', 'linux'],
            requires: ['chromium'],
            emoji: '🌐',
        };
        expect(meta.events).toContain('message');
        expect(meta.os).toContain('darwin');
        expect(meta.requires).toContain('chromium');
        expect(meta.always).toBe(true);
        expect(meta.emoji).toBe('🌐');
    });
});

describe('SkillEntry interface', () => {
    it('represents a fully discovered skill', () => {
        const entry: SkillEntry = {
            id: 'web-search',
            baseDir: '/skills/web-search',
            markdownPath: '/skills/web-search/SKILL.md',
            instructions: '# Web Search\nSearch for information.',
            metadata: {
                name: 'Web Search',
                description: 'Find things online',
            },
            source: 'bundled',
        };
        expect(entry.id).toBe('web-search');
        expect(entry.source).toBe('bundled');
        expect(entry.instructions).toContain('# Web Search');
    });

    it('supports all source types', () => {
        const sources: SkillEntry['source'][] = ['bundled', 'workspace', 'remote'];
        for (const source of sources) {
            const entry: SkillEntry = {
                id: `test-${source}`,
                baseDir: '/test',
                markdownPath: '/test/SKILL.md',
                instructions: '',
                metadata: { name: 'test', description: 'test' },
                source,
            };
            expect(entry.source).toBe(source);
        }
    });
});

describe('SkillHandler type', () => {
    it('accepts a handler function that returns string', async () => {
        const handler: SkillHandler = async (ctx) => `Handled: ${ctx.event}`;
        const result = await handler({ event: 'message', input: 'hello' });
        expect(result).toBe('Handled: message');
    });

    it('accepts a handler function that returns void', async () => {
        const handler: SkillHandler = async (_ctx) => { /* side effect */ };
        const result = await handler({ event: 'tool-call', input: '{}' });
        expect(result).toBeUndefined();
    });
});

describe('SkillContext interface', () => {
    it('supports required fields', () => {
        const ctx: SkillContext = { event: 'message', input: 'hello' };
        expect(ctx.event).toBe('message');
        expect(ctx.input).toBe('hello');
    });

    it('supports optional fields', () => {
        const ctx: SkillContext = {
            event: 'tool-call',
            input: '{}',
            sessionId: 'sess_123',
            extra: { model: 'gpt-4', temperature: 0.5 },
        };
        expect(ctx.sessionId).toBe('sess_123');
        expect(ctx.extra?.model).toBe('gpt-4');
    });
});
