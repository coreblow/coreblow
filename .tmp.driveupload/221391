// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from './event-bus.js';
import { TemplateEngine } from './template-engine.js';

describe('Event Bus — Phase 17', () => {
    let bus: EventBus;

    beforeEach(() => { bus = new EventBus(); });

    it('emits and handles event', async () => {
        const received: unknown[] = [];
        bus.on('test', (data) => received.push(data));
        const count = await bus.emit('test', { msg: 'hello' });
        expect(count).toBe(1);
        expect(received).toEqual([{ msg: 'hello' }]);
    });

    it('once listener fires only once', async () => {
        let calls = 0;
        bus.once('one', () => { calls++; });
        await bus.emit('one');
        await bus.emit('one');
        expect(calls).toBe(1);
    });

    it('off removes listener', async () => {
        let calls = 0;
        const fn = () => { calls++; };
        bus.on('x', fn);
        bus.off('x', fn);
        await bus.emit('x');
        expect(calls).toBe(0);
    });

    it('returns 0 for no handlers', async () => {
        expect(await bus.emit('nothing')).toBe(0);
    });

    it('multiple handlers on same event', async () => {
        let a = 0, b = 0;
        bus.on('multi', () => { a++; });
        bus.on('multi', () => { b++; });
        await bus.emit('multi');
        expect(a).toBe(1);
        expect(b).toBe(1);
    });

    it('getHistory returns events', async () => {
        await bus.emit('a', 1);
        await bus.emit('b', 2);
        const all = bus.getHistory();
        expect(all).toHaveLength(2);
        const filtered = bus.getHistory('a');
        expect(filtered).toHaveLength(1);
    });

    it('getStats tracks emitted/handled', async () => {
        bus.on('s', () => {});
        await bus.emit('s');
        await bus.emit('s');
        const stats = bus.getStats();
        expect(stats.emitted).toBe(2);
        expect(stats.handled).toBe(2);
    });

    it('listEvents returns event handler counts', () => {
        bus.on('a', () => {});
        bus.on('a', () => {});
        bus.on('b', () => {});
        const events = bus.listEvents();
        expect(events.find(e => e.event === 'a')!.handlers).toBe(2);
        expect(events.find(e => e.event === 'b')!.handlers).toBe(1);
    });
});

describe('Template Engine — Phase 17', () => {
    let engine: TemplateEngine;

    beforeEach(() => { engine = new TemplateEngine(); });

    it('interpolates variables', () => {
        expect(engine.render('Hello {{name}}!', { name: 'World' })).toBe('Hello World!');
    });

    it('handles missing variables', () => {
        expect(engine.render('Hi {{name}}', {})).toBe('Hi ');
    });

    it('applies upper filter', () => {
        expect(engine.render('{{name|upper}}', { name: 'hello' })).toBe('HELLO');
    });

    it('applies lower filter', () => {
        expect(engine.render('{{name|lower}}', { name: 'WORLD' })).toBe('world');
    });

    it('applies capitalize filter', () => {
        expect(engine.render('{{name|capitalize}}', { name: 'hello' })).toBe('Hello');
    });

    it('applies truncate filter', () => {
        expect(engine.render('{{text|truncate:5}}', { text: 'hello world' })).toBe('hello...');
    });

    it('applies escape filter', () => {
        expect(engine.render('{{html|escape}}', { html: '<b>hi</b>' })).toBe('&lt;b&gt;hi&lt;/b&gt;');
    });

    it('renders conditionals', () => {
        expect(engine.render('{{#if show}}visible{{/if}}', { show: true })).toBe('visible');
        expect(engine.render('{{#if show}}visible{{/if}}', { show: false })).toBe('');
    });

    it('renders if/else', () => {
        expect(engine.render('{{#if show}}yes{{#else}}no{{/if}}', { show: false })).toBe('no');
    });

    it('renders each loops', () => {
        expect(engine.render('{{#each items}}{{this}},{{/each}}', { items: ['a', 'b', 'c'] })).toBe('a,b,c,');
    });

    it('renders each with objects', () => {
        const result = engine.render('{{#each users}}{{name}} {{/each}}', { users: [{ name: 'Alice' }, { name: 'Bob' }] });
        expect(result).toBe('Alice Bob ');
    });

    it('renders partials', () => {
        engine.registerPartial('header', '# Header');
        expect(engine.render('{{> header}} body')).toBe('# Header body');
    });

    it('renders named templates', () => {
        engine.register('greeting', 'Hello {{name}}!');
        expect(engine.renderNamed('greeting', { name: 'CoreBlow' })).toBe('Hello CoreBlow!');
    });

    it('throws for unknown named template', () => {
        expect(() => engine.renderNamed('nope')).toThrow('Template "nope" not found');
    });

    it('resolves nested keys', () => {
        expect(engine.render('{{user.name}}', { user: { name: 'Alice' } })).toBe('Alice');
    });

    it('custom filter', () => {
        engine.registerFilter('reverse', (v) => String(v).split('').reverse().join(''));
        expect(engine.render('{{text|reverse}}', { text: 'abc' })).toBe('cba');
    });

    it('listTemplates and listFilters', () => {
        engine.register('t1', 'x');
        expect(engine.listTemplates()).toContain('t1');
        expect(engine.listFilters()).toContain('upper');
    });
});
