/**
 * CoreBlow Phase 38 — RouteMatcher & MiddlewareChain Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - RouteMatcher: path params, wildcards, method filtering, query parsing
 *   - MiddlewareChain: use, execute, path filtering, error handling, stats
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { RouteMatcher } from '../../src/gateway/route-matcher.js';
import { MiddlewareChain } from '../../src/gateway/middleware-chain.js';

// ================================================================
describe('RouteMatcher — Extended', () => {
    let router: RouteMatcher;
    beforeEach(() => { router = new RouteMatcher(); });

    it('should match exact path', () => {
        router.get('/api/health', 'healthHandler');
        const match = router.match('GET', '/api/health');
        expect(match).not.toBeNull();
        expect(match?.route.handler).toBe('healthHandler');
    });

    it('should match path parameters', () => {
        router.get('/api/users/:id', 'getUser');
        const match = router.match('GET', '/api/users/123');
        expect(match?.params.id).toBe('123');
    });

    it('should match multiple path parameters', () => {
        router.get('/api/:org/:repo/issues/:id', 'getIssue');
        const match = router.match('GET', '/api/coreblow/gateway/issues/42');
        expect(match?.params.org).toBe('coreblow');
        expect(match?.params.repo).toBe('gateway');
        expect(match?.params.id).toBe('42');
    });

    it('should match wildcard routes', () => {
        router.get('/static/*', 'staticHandler');
        const match = router.match('GET', '/static/css/main.css');
        expect(match).not.toBeNull();
    });

    it('should filter by HTTP method', () => {
        router.get('/api/data', 'getData');
        router.post('/api/data', 'postData');

        expect(router.match('GET', '/api/data')?.route.handler).toBe('getData');
        expect(router.match('POST', '/api/data')?.route.handler).toBe('postData');
        expect(router.match('DELETE', '/api/data')).toBeNull();
    });

    it('should parse query string', () => {
        router.get('/api/search', 'search');
        const match = router.match('GET', '/api/search?q=test&limit=10');
        expect(match?.query?.q).toBe('test');
        expect(match?.query?.limit).toBe('10');
    });

    it('should return null for unmatched path', () => {
        router.get('/api/v1', 'handler');
        expect(router.match('GET', '/api/v2')).toBeNull();
    });

    it('should support PUT and DELETE', () => {
        router.put('/api/items/:id', 'updateItem');
        router.delete('/api/items/:id', 'deleteItem');
        expect(router.match('PUT', '/api/items/5')?.route.handler).toBe('updateItem');
        expect(router.match('DELETE', '/api/items/5')?.route.handler).toBe('deleteItem');
    });

    it('should list and count routes', () => {
        router.get('/a', 'h1');
        router.post('/b', 'h2');
        router.put('/c', 'h3');
        expect(router.count()).toBe(3);
        expect(router.list()).toHaveLength(3);
    });
});

// ================================================================
describe('MiddlewareChain — Extended', () => {
    let chain: MiddlewareChain;
    beforeEach(() => { chain = new MiddlewareChain(); });

    it('should execute middleware in order', async () => {
        const log: string[] = [];
        chain.use('first', async (ctx, next) => { log.push('first'); await next(); });
        chain.use('second', async (ctx, next) => { log.push('second'); await next(); });

        const ctx = chain.createContext('GET', '/test');
        await chain.execute(ctx);
        expect(log).toEqual(['first', 'second']);
    });

    it('should pass state between middlewares', async () => {
        chain.use('auth', async (ctx, next) => { ctx.state.userId = 'u-123'; await next(); });
        chain.use('handler', async (ctx, next) => { ctx.response.body = { user: ctx.state.userId }; });

        const ctx = chain.createContext('GET', '/profile');
        const result = await chain.execute(ctx);
        expect((result.response.body as any).user).toBe('u-123');
    });

    it('should filter by path prefix', async () => {
        const log: string[] = [];
        chain.use('global', async (_, next) => { log.push('global'); await next(); });
        chain.use('api-only', async (_, next) => { log.push('api'); await next(); }, '/api');

        const ctx1 = chain.createContext('GET', '/api/data');
        await chain.execute(ctx1);
        expect(log).toEqual(['global', 'api']);

        log.length = 0;
        const ctx2 = chain.createContext('GET', '/static/file');
        await chain.execute(ctx2);
        expect(log).toEqual(['global']);
    });

    it('should handle errors and set 500', async () => {
        chain.use('crash', async () => { throw new Error('boom'); });
        const ctx = chain.createContext('GET', '/test');
        const result = await chain.execute(ctx);
        expect(result.response.status).toBe(500);
    });

    it('should track stats', async () => {
        chain.use('noop', async (_, next) => { await next(); });
        await chain.execute(chain.createContext('GET', '/'));
        await chain.execute(chain.createContext('GET', '/'));
        expect(chain.getStats().executed).toBe(2);
    });

    it('should list and count middlewares', () => {
        chain.use('a', async (_, n) => n());
        chain.use('b', async (_, n) => n(), '/api');
        expect(chain.count()).toBe(2);
        expect(chain.list()).toEqual([{ name: 'a' }, { name: 'b', path: '/api' }]);
    });
});
