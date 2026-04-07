/**
 * CoreBlow Phase 36 — API Gateway & Routing Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { RouteMatcher } from '../../src/gateway/route-matcher.js';
import { RequestPipeline } from '../../src/gateway/request-pipeline.js';
import { ResponseBuilder } from '../../src/gateway/response-builder.js';
import { MiddlewareChain } from '../../src/gateway/middleware-chain.js';
import { ApiGateway } from '../../src/gateway/api-gateway.js';

// ================================================================
describe('RouteMatcher', () => {
    let router: RouteMatcher;
    beforeEach(() => {
        router = new RouteMatcher();
        router.get('/api/users', 'listUsers');
        router.get('/api/users/:id', 'getUser');
        router.post('/api/users', 'createUser');
    });

    it('should match exact paths', () => {
        const match = router.match('GET', '/api/users');
        expect(match?.route.handler).toBe('listUsers');
    });

    it('should match path params', () => {
        const match = router.match('GET', '/api/users/123');
        expect(match?.params.id).toBe('123');
    });

    it('should match methods', () => {
        expect(router.match('POST', '/api/users')).toBeTruthy();
        expect(router.match('DELETE', '/api/users')).toBeNull();
    });

    it('should parse query strings', () => {
        const match = router.match('GET', '/api/users?page=1&limit=10');
        expect(match?.query?.page).toBe('1');
    });

    it('should return null for unknown', () => {
        expect(router.match('GET', '/unknown')).toBeNull();
    });

    it('should list routes', () => {
        expect(router.list()).toHaveLength(3);
    });
});

// ================================================================
describe('RequestPipeline', () => {
    let pipeline: RequestPipeline;
    beforeEach(() => { pipeline = new RequestPipeline(); });

    it('should process through stages', async () => {
        pipeline.use('auth', async (ctx) => { ctx.state.authed = true; return ctx; });
        pipeline.use('log', async (ctx) => { ctx.state.logged = true; return ctx; });
        const ctx = { method: 'GET', path: '/', headers: {}, params: {}, state: {} };
        const result = await pipeline.process(ctx);
        expect(result.state.authed).toBe(true);
        expect(result.state.logged).toBe(true);
    });

    it('should abort on null return', async () => {
        pipeline.use('block', async () => null);
        pipeline.use('never', async (ctx) => { ctx.state.reached = true; return ctx; });
        const ctx = { method: 'GET', path: '/', headers: {}, params: {}, state: {} };
        const result = await pipeline.process(ctx);
        expect(result.state.reached).toBeUndefined();
    });

    it('should track stats', async () => {
        pipeline.use('pass', async (ctx) => ctx);
        await pipeline.process({ method: 'GET', path: '/', headers: {}, params: {}, state: {} });
        expect(pipeline.getStats().processed).toBe(1);
    });
});

// ================================================================
describe('ResponseBuilder', () => {
    it('should build JSON response', () => {
        const res = new ResponseBuilder().status(200).json({ ok: true }).build();
        expect(res.status).toBe(200);
        expect(res.headers['Content-Type']).toBe('application/json');
    });

    it('should build text response', () => {
        const res = new ResponseBuilder().text('hello').build();
        expect(res.headers['Content-Type']).toBe('text/plain');
    });

    it('should build HTML response', () => {
        const res = new ResponseBuilder().html('<h1>Hi</h1>').build();
        expect(res.headers['Content-Type']).toBe('text/html');
    });

    it('should set custom headers', () => {
        const res = new ResponseBuilder().header('X-Custom', 'test').build();
        expect(res.headers['X-Custom']).toBe('test');
    });

    it('should use static factories', () => {
        expect(ResponseBuilder.ok({ data: 1 }).status).toBe(200);
        expect(ResponseBuilder.notFound().status).toBe(404);
        expect(ResponseBuilder.error('fail').status).toBe(500);
        expect(ResponseBuilder.created({}).status).toBe(201);
    });
});

// ================================================================
describe('MiddlewareChain', () => {
    let chain: MiddlewareChain;
    beforeEach(() => { chain = new MiddlewareChain(); });

    it('should execute in order', async () => {
        const order: string[] = [];
        chain.use('a', async (_, next) => { order.push('a'); await next(); });
        chain.use('b', async (_, next) => { order.push('b'); await next(); });
        await chain.execute(chain.createContext('GET', '/'));
        expect(order).toEqual(['a', 'b']);
    });

    it('should pass context', async () => {
        chain.use('auth', async (ctx, next) => { ctx.state.user = 'alice'; await next(); });
        const ctx = chain.createContext('GET', '/');
        await chain.execute(ctx);
        expect(ctx.state.user).toBe('alice');
    });

    it('should scope by path', async () => {
        chain.use('api-only', async (ctx, next) => { ctx.state.api = true; await next(); }, '/api');
        const ctx1 = chain.createContext('GET', '/api/users');
        const ctx2 = chain.createContext('GET', '/public');
        await chain.execute(ctx1);
        await chain.execute(ctx2);
        expect(ctx1.state.api).toBe(true);
        expect(ctx2.state.api).toBeUndefined();
    });

    it('should handle errors', async () => {
        chain.use('boom', async () => { throw new Error('fail'); });
        const ctx = chain.createContext('GET', '/');
        await chain.execute(ctx);
        expect(ctx.response.status).toBe(500);
    });
});

// ================================================================
describe('ApiGateway', () => {
    let gw: ApiGateway;
    beforeEach(() => {
        gw = new ApiGateway();
        gw.get('/api/hello', async (ctx) => { ctx.response.body = { message: 'hello' }; });
        gw.post('/api/echo', async (ctx) => { ctx.response.body = ctx.request.body; });
    });

    it('should handle GET', async () => {
        const res = await gw.handle('GET', '/api/hello');
        expect(res.body).toEqual({ message: 'hello' });
    });

    it('should handle POST with body', async () => {
        const res = await gw.handle('POST', '/api/echo', {}, { data: 123 });
        expect(res.body).toEqual({ data: 123 });
    });

    it('should return 404 for unknown', async () => {
        const res = await gw.handle('GET', '/unknown');
        expect(res.status).toBe(404);
    });

    it('should track stats', async () => {
        await gw.handle('GET', '/api/hello');
        expect(gw.getStats().requests).toBe(1);
    });
});
