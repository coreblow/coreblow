/**
 * CoreBlow Phase 18 — API & Middleware Layer Tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MiddlewareComposer } from '../../src/gateway/middleware.js';
import { ApiDocsGenerator } from '../../src/gateway/api-docs.js';
import { RequestInterceptor } from '../../src/gateway/interceptor.js';
import { RBACSystem } from '../../src/security/rbac.js';
import { RateLimitMiddleware } from '../../src/gateway/rate-limit-middleware.js';

// ================================================================
// Middleware Composer Tests
// ================================================================
describe('MiddlewareComposer', () => {
    let composer: MiddlewareComposer;
    beforeEach(() => { composer = new MiddlewareComposer(); });

    it('should execute middleware in order', async () => {
        const order: number[] = [];
        composer.use('first', async (_, next) => { order.push(1); await next(); });
        composer.use('second', async (_, next) => { order.push(2); await next(); });
        const ctx = MiddlewareComposer.createContext('GET', '/test');
        await composer.execute(ctx);
        expect(order).toEqual([1, 2]);
    });

    it('should modify context', async () => {
        composer.use('auth', async (ctx, next) => { ctx.state['user'] = 'alice'; await next(); });
        composer.use('handler', async (ctx, next) => { ctx.response.body = `Hello ${ctx.state['user']}`; await next(); });
        const ctx = MiddlewareComposer.createContext('GET', '/');
        await composer.execute(ctx);
        expect(ctx.response.body).toBe('Hello alice');
    });

    it('should handle errors', async () => {
        let caught = '';
        composer.onError((err) => { caught = err.message; });
        composer.use('fail', async () => { throw new Error('oops'); });
        const ctx = MiddlewareComposer.createContext('GET', '/');
        await composer.execute(ctx);
        expect(caught).toBe('oops');
    });

    it('should skip conditional middleware', async () => {
        let called = false;
        composer.use('skip', async (_, next) => { called = true; await next(); }, { condition: (ctx) => ctx.method === 'POST' });
        const ctx = MiddlewareComposer.createContext('GET', '/');
        await composer.execute(ctx);
        expect(called).toBe(false);
    });

    it('should list middleware', () => {
        composer.use('a', async (_, next) => next());
        composer.use('b', async (_, next) => next());
        expect(composer.list()).toEqual(['a', 'b']);
    });

    it('should remove middleware', () => {
        composer.use('temp', async (_, next) => next());
        expect(composer.remove('temp')).toBe(true);
        expect(composer.list()).toEqual([]);
    });
});

// ================================================================
// API Docs Generator Tests
// ================================================================
describe('ApiDocsGenerator', () => {
    let docs: ApiDocsGenerator;
    beforeEach(() => {
        docs = new ApiDocsGenerator({ title: 'CoreBlow API', version: '1.0.0', description: 'AI Gateway' });
    });

    it('should generate CoreAPI spec', () => {
        const spec = docs.generate() as any;
        expect(spec.coreapi).toBe('3.0.3');
        expect(spec.info.title).toBe('CoreBlow API');
    });

    it('should add routes', () => {
        docs.addRoute({
            path: '/v1/chat/completions',
            method: 'POST',
            summary: 'Chat completions',
            tags: ['Chat'],
            responses: { '200': { description: 'Success' } },
        });
        expect(docs.routeCount()).toBe(1);
        const spec = docs.generate() as any;
        expect(spec.paths['/v1/chat/completions'].post.summary).toBe('Chat completions');
    });

    it('should add servers', () => {
        docs.addServer('https://api.coreblow.com', 'Production');
        const spec = docs.generate() as any;
        expect(spec.servers[0].url).toBe('https://api.coreblow.com');
    });

    it('should add tags', () => {
        docs.addTag('Chat', 'Chat endpoints');
        const spec = docs.generate() as any;
        expect(spec.tags[0].name).toBe('Chat');
    });

    it('should export JSON', () => {
        const json = docs.toJSON();
        expect(JSON.parse(json).coreapi).toBe('3.0.3');
    });
});

// ================================================================
// Request Interceptor Tests
// ================================================================
describe('RequestInterceptor', () => {
    let interceptor: RequestInterceptor;
    beforeEach(() => { interceptor = new RequestInterceptor(); });

    it('should create requests with IDs', () => {
        const req = interceptor.createRequest('GET', '/api/test');
        expect(req.id).toBeTruthy();
        expect(req.method).toBe('GET');
    });

    it('should process request hooks', () => {
        interceptor.onRequest('uppercase', (req) => ({ ...req, path: req.path.toUpperCase() }));
        const req = interceptor.createRequest('GET', '/test');
        const processed = interceptor.processRequest(req);
        expect(processed?.path).toBe('/TEST');
    });

    it('should block requests', () => {
        interceptor.onRequest('block', () => null);
        const req = interceptor.createRequest('GET', '/blocked');
        expect(interceptor.processRequest(req)).toBeNull();
    });

    it('should process response hooks', () => {
        interceptor.onResponse('addHeader', (_, res) => ({
            ...res,
            headers: { ...res.headers, 'X-Powered-By': 'CoreBlow' },
        }));
        const req = interceptor.createRequest('GET', '/test');
        const res = interceptor.processResponse(req, { status: 200, headers: {}, durationMs: 5 });
        expect(res.headers['X-Powered-By']).toBe('CoreBlow');
    });

    it('should log requests', () => {
        const req = interceptor.createRequest('GET', '/test');
        interceptor.processResponse(req, { status: 200, headers: {}, durationMs: 10 });
        expect(interceptor.getLog()).toHaveLength(1);
    });

    it('should list hooks', () => {
        interceptor.onRequest('a', (r) => r);
        interceptor.onResponse('b', (_, r) => r);
        expect(interceptor.listHooks().request).toEqual(['a']);
        expect(interceptor.listHooks().response).toEqual(['b']);
    });
});

// ================================================================
// RBAC Tests
// ================================================================
describe('RBACSystem', () => {
    let rbac: RBACSystem;
    beforeEach(() => { rbac = new RBACSystem(); });

    it('should have built-in roles', () => {
        const roles = rbac.listRoles();
        expect(roles.map((r) => r.name)).toContain('owner');
        expect(roles.map((r) => r.name)).toContain('admin');
        expect(roles.map((r) => r.name)).toContain('user');
    });

    it('should assign roles', () => {
        expect(rbac.assignRole('user1', 'admin')).toBe(true);
        expect(rbac.getUserRoles('user1')).toContain('admin');
    });

    it('should check owner permissions', () => {
        rbac.assignRole('user1', 'owner');
        expect(rbac.can('user1', 'anything', 'any-action')).toBe(true);
    });

    it('should check admin permissions', () => {
        rbac.assignRole('user1', 'admin');
        expect(rbac.can('user1', 'agents', 'read')).toBe(true);
        expect(rbac.can('user1', 'agents', 'delete')).toBe(false);
    });

    it('should check user permissions', () => {
        rbac.assignRole('user1', 'user');
        expect(rbac.can('user1', 'agents', 'execute')).toBe(true);
        expect(rbac.can('user1', 'config', 'write')).toBe(false);
    });

    it('should revoke roles', () => {
        rbac.assignRole('user1', 'admin');
        expect(rbac.revokeRole('user1', 'admin')).toBe(true);
        expect(rbac.can('user1', 'agents', 'read')).toBe(false);
    });

    it('should support role inheritance', () => {
        rbac.addRole({ name: 'super-admin', permissions: [], inherits: ['admin'] });
        rbac.assignRole('user1', 'super-admin');
        expect(rbac.can('user1', 'agents', 'write')).toBe(true);
    });

    it('should return false for unknown users', () => {
        expect(rbac.can('unknown', 'agents', 'read')).toBe(false);
    });
});

// ================================================================
// Rate Limit Middleware Tests
// ================================================================
describe('RateLimitMiddleware', () => {
    let rl: RateLimitMiddleware;
    afterEach(() => { rl?.destroy(); });

    it('should allow requests within limit', async () => {
        rl = new RateLimitMiddleware([{ pattern: '/api', limit: 5, windowMs: 10_000 }]);
        const mw = rl.middleware();
        const ctx = MiddlewareComposer.createContext('GET', '/api/test', { 'x-forwarded-for': '1.2.3.4' });
        await mw(ctx, async () => {});
        expect(ctx.response.status).toBe(200);
        expect(ctx.response.headers['X-RateLimit-Remaining']).toBe('4');
    });

    it('should block over-limit requests', async () => {
        rl = new RateLimitMiddleware([{ pattern: '/api', limit: 2, windowMs: 10_000 }]);
        const mw = rl.middleware();
        for (let i = 0; i < 3; i++) {
            const ctx = MiddlewareComposer.createContext('GET', '/api', { 'x-forwarded-for': '1.2.3.4' });
            await mw(ctx, async () => {});
            if (i === 2) {
                expect(ctx.response.status).toBe(429);
                expect(ctx.response.headers['Retry-After']).toBeTruthy();
            }
        }
    });

    it('should pass through unmatched routes', async () => {
        rl = new RateLimitMiddleware([{ pattern: '/api', limit: 1, windowMs: 10_000 }]);
        const mw = rl.middleware();
        const ctx = MiddlewareComposer.createContext('GET', '/other');
        await mw(ctx, async () => {});
        expect(ctx.response.status).toBe(200);
    });

    it('should add rules dynamically', () => {
        rl = new RateLimitMiddleware();
        rl.addRule({ pattern: '/test', limit: 10, windowMs: 60_000 });
        // No crash
    });
});
