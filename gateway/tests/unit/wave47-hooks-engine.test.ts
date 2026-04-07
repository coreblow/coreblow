import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HooksEngine } from '../../src/hooks/engine.js';
import { 
    markdownToHtml, 
    htmlToPlaintext, 
    markdownToPlaintext, 
    formatForChannel 
} from '../../src/hooks/message-hook-mappers.js';
import type { HookEntry, HookContext } from '../../src/hooks/engine.js';

describe('Wave 47: Hooks Engine', () => {

    describe('HooksEngine (engine.ts)', () => {
        let engine: HooksEngine;

        beforeEach(() => {
            engine = new HooksEngine();
        });

        afterEach(() => {
            engine.clear();
        });

        function makeHook(id: string, events: string[], priority = 100, handler: any = vi.fn().mockResolvedValue(undefined)): HookEntry {
            return {
                id,
                name: `Hook ${id}`,
                source: 'plugin',
                metadata: { events, priority },
                handler,
                enabled: true
            };
        }

        it('registers and emits events sequentially by priority', async () => {
            const order: number[] = [];
            
            engine.register(makeHook('h1', ['test'], 200, async () => { order.push(1); }));
            engine.register(makeHook('h2', ['test'], 50, async () => { order.push(2); }));
            engine.register(makeHook('h3', ['test'], 100, async () => { order.push(3); }));

            const results = await engine.emit('test');
            
            expect(results).toHaveLength(3);
            expect(order).toEqual([2, 3, 1]); // Priority 50, then 100, then 200
        });

        it('passes context correctly to handlers', async () => {
            const handler = vi.fn().mockResolvedValue(undefined);
            engine.register(makeHook('h1', ['test.event'], 100, handler));

            await engine.emit('test.event', { foo: 'bar' });

            expect(handler).toHaveBeenCalledTimes(1);
            const ctx: HookContext = handler.mock.calls[0][0];
            expect(ctx.event).toBe('test.event');
            expect(ctx.payload).toEqual({ foo: 'bar' });
            expect(ctx.shared).toEqual({}); // Shared state starts empty
            expect(ctx.timestamp).toBeLessThanOrEqual(Date.now());
        });

        it('shared bag allows cross-hook communication', async () => {
            engine.register(makeHook('h1', ['event'], 10, async (ctx) => { ctx.shared['handledByFirst'] = true; }));
            engine.register(makeHook('h2', ['event'], 20, async (ctx) => { 
                if (ctx.shared['handledByFirst']) ctx.shared['success'] = true; 
            }));

            const handler3 = vi.fn().mockImplementation(async (ctx) => {
                expect(ctx.shared['success']).toBe(true);
            });
            engine.register(makeHook('h3', ['event'], 30, handler3));

            await engine.emit('event');
            expect(handler3).toHaveBeenCalledTimes(1);
        });

        it('isolates errors so subsequent hooks still run', async () => {
            engine.register(makeHook('h1', ['event'], 10, async () => { throw new Error('Crashed'); }));
            const h2 = vi.fn().mockResolvedValue(undefined);
            engine.register(makeHook('h2', ['event'], 20, h2));

            const results = await engine.emit('event');
            
            expect(h2).toHaveBeenCalledTimes(1);
            expect(results[0].error).toContain('Crashed');
            expect(results[1].error).toBeUndefined();
        });

        it('handles fireAndForget asynchronously', async () => {
            // Need a way to ensure the promise hasn't resolved before we check
            let resolvePromise: () => void;
            const promise = new Promise<void>((r) => { resolvePromise = r; });
            
            engine.register({
                id: 'h1',
                name: 'async',
                source: 'plugin',
                metadata: { events: ['event'], fireAndForget: true }, // Fire and forget
                handler: () => promise,
                enabled: true
            });

            // This should not await the hook internally
            const results = await engine.emit('event');
            expect(results).toHaveLength(1);
            expect(results[0].durationMs).toBe(0); // Instantly returns 0 duration mock result

            resolvePromise!();
        });

        it('maintains execution history', async () => {
            engine.register(makeHook('h1', ['event']));
            await engine.emit('event');
            await engine.emit('other'); // No match
            await engine.emit('event');

            const hist = engine.getHistory();
            expect(hist).toHaveLength(2);
            expect(hist[0].hookId).toBe('h1');
            expect(hist[1].hookId).toBe('h1');
        });

        it('respects enabled flag', async () => {
            const h1 = vi.fn();
            engine.register(makeHook('h1', ['event'], 100, h1));
            
            engine.setEnabled('h1', false);
            await engine.emit('event');
            expect(h1).not.toHaveBeenCalled();

            engine.setEnabled('h1', true);
            await engine.emit('event');
            expect(h1).toHaveBeenCalledTimes(1);
        });
    });

    describe('Message Hook Mappers', () => {
        it('markdownToHtml converts basic syntax', () => {
            const md = '# Title\n## Subtitle\n**Bold** and *Italic*\n`code`';
            const html = markdownToHtml(md);
            expect(html).toContain('<h1>Title</h1>');
            expect(html).toContain('<h2>Subtitle</h2>');
            expect(html).toContain('<strong>Bold</strong>');
            expect(html).toContain('<em>Italic</em>');
            expect(html).toContain('<code>code</code>');
        });

        it('htmlToPlaintext strips tags', () => {
            const html = '<h1>Title</h1><p>Some <strong>bold</strong> text</p>';
            const plain = htmlToPlaintext(html);
            expect(plain).toBe('TitleSome bold text'); // simplistic regex removal
        });

        it('markdownToPlaintext strips markers', () => {
            const md = '# Title\n**Bold** and [link](http://test)';
            const plain = markdownToPlaintext(md);
            expect(plain).toBe('Title\nBold and link (http://test)');
        });

        it('formatForChannel formats correctly', () => {
            const md = '**Bold**';
            expect(formatForChannel(md, 'discord')).toBe('**Bold**');
            expect(formatForChannel(md, 'slack')).toBe('*Bold*'); // Slack uses single asterisk for bold
            expect(formatForChannel(md, 'telegram')).toBe('**Bold**');
            expect(formatForChannel(md, 'html')).toContain('<strong>Bold</strong>');
            expect(formatForChannel(md, 'plain')).toBe('Bold');
        });
    });
});
