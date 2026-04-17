import { describe, it, expect, beforeEach } from 'vitest';
import { MiddlewareComposer, type MiddlewareContext } from './middleware.js';

describe('Gateway Middleware — Phase 6', () => {
    let composer: MiddlewareComposer;

    beforeEach(() => {
        composer = new MiddlewareComposer();
    });

    it('executes middleware in order', async () => {
        const order: string[] = [];
        composer.use('first', async (_ctx, next) => { order.push('first'); await next(); });
        composer.use('second', async (_ctx, next) => { order.push('second'); await next(); });
        composer.use('third', async (_ctx, next) => { order.push('third'); await next(); });

        const ctx = MiddlewareComposer.createContext('GET', '/test');
        await composer.execute(ctx);
        expect(order).toEqual(['first', 'second', 'third']);
    });

    it('middleware can modify context', async () => {
        composer.use('auth', async (ctx, next) => { ctx.state.user = 'alice'; await next(); });
        composer.use('handler', async (ctx, next) => { ctx.response.body = `hello ${ctx.state.user}`; await next(); });
        const ctx = MiddlewareComposer.createContext('GET', '/me');
        await composer.execute(ctx);
        expect(ctx.response.body).toBe('hello alice');
    });

    it('middleware can short-circuit', async () => {
        const order: string[] = [];
        composer.use('gate', async (ctx) => { order.push('gate'); ctx.response.status = 401; });
        composer.use('handler', async (_ctx, next) => { order.push('handler'); await next(); });
        const ctx = MiddlewareComposer.createContext('GET', '/');
        await composer.execute(ctx);
        expect(order).toEqual(['gate']);
    });

    it('conditional middleware skips when false', async () => {
        const order: string[] = [];
        composer.use('always', async (_ctx, next) => { order.push('always'); await next(); });
        composer.use('admin', async (_ctx, next) => { order.push('admin'); await next(); }, { condition: (ctx) => ctx.path.startsWith('/admin') });
        const ctx = MiddlewareComposer.createContext('GET', '/public');
        await composer.execute(ctx);
        expect(order).toEqual(['always']);
    });

    it('error handler catches errors', async () => {
        let caught: string | null = null;
        composer.onError((err) => { caught = err.message; });
        composer.use('broken', async () => { throw new Error('boom'); });
        await composer.execute(MiddlewareComposer.createContext('GET', '/'));
        expect(caught).toBe('boom');
    });

    it('throws when no error handler', async () => {
        composer.use('broken', async () => { throw new Error('unhandled'); });
        await expect(composer.execute(MiddlewareComposer.createContext('GET', '/'))).rejects.toThrow('unhandled');
    });

    it('respects custom order', async () => {
        const order: string[] = [];
        composer.use('late', async (_ctx, next) => { order.push('late'); await next(); }, { order: 10 });
        composer.use('early', async (_ctx, next) => { order.push('early'); await next(); }, { order: 1 });
        await composer.execute(MiddlewareComposer.createContext('GET', '/'));
        expect(order).toEqual(['early', 'late']);
    });

    it('list/remove middleware', () => {
        composer.use('cors', async (_ctx, next) => next());
        composer.use('auth', async (_ctx, next) => next());
        expect(composer.list()).toEqual(['cors', 'auth']);
        composer.remove('auth');
        expect(composer.list()).toEqual(['cors']);
    });

    it('records metrics', async () => {
        composer.use('test', async (_ctx, next) => next());
        await composer.execute(MiddlewareComposer.createContext('GET', '/'));
        expect(composer.getMetrics()).toHaveLength(1);
        expect(composer.getMetrics()[0]!.name).toBe('test');
    });

    it('createContext produces valid context', () => {
        const ctx = MiddlewareComposer.createContext('POST', '/api', { 'x-key': 'v' }, { d: 1 });
        expect(ctx.method).toBe('POST');
        expect(ctx.path).toBe('/api');
        expect(ctx.body).toEqual({ d: 1 });
        expect(ctx.response.status).toBe(200);
    });
});
