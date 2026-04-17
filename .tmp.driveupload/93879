/**
 * CoreBlow Phase 38 — Gateway & Routing Chaos Tests
 *
 * Layer 3 (Adversarial):
 *   - RouteMatcher: 50 routes, deep params, conflicting patterns
 *   - MiddlewareChain: 20 chained middlewares, error mid-chain
 *   - ProviderRegistry: mass registration, health toggling
 *   - ResponseBuilder: all status codes
 */
import { describe, it, expect } from 'vitest';
import { RouteMatcher } from '../../src/gateway/route-matcher.js';
import { MiddlewareChain } from '../../src/gateway/middleware-chain.js';
import { ProviderRegistry } from '../../src/providers/provider-registry.js';
import { ResponseBuilder } from '../../src/gateway/response-builder.js';
import type { ModelProvider } from '../../src/agents/runtime.js';

const mockProvider = (id: string): ModelProvider => ({
    id, name: id,
    generateText: async () => ({ text: '', usage: { input: 0, output: 0 } }),
    generateStream: async function* () {},
});

// ================================================================
describe('Phase38 Chaos: Route Matching Stress', () => {
    it('50 routes registered — matching accurate', () => {
        const router = new RouteMatcher();
        for (let i = 0; i < 50; i++) {
            router.get(`/api/v${i}/resource`, `handler-${i}`);
        }
        expect(router.count()).toBe(50);

        // Match specific route
        const match = router.match('GET', '/api/v25/resource');
        expect(match?.route.handler).toBe('handler-25');

        // No false matches
        expect(router.match('GET', '/api/v999/resource')).toBeNull();
    });

    it('deeply nested path params', () => {
        const router = new RouteMatcher();
        router.get('/a/:b/c/:d/e/:f', 'deep');
        const match = router.match('GET', '/a/1/c/2/e/3');
        expect(match?.params).toEqual({ b: '1', d: '2', f: '3' });
    });

    it('query with special characters', () => {
        const router = new RouteMatcher();
        router.get('/search', 'search');
        const match = router.match('GET', '/search?q=hello%20world&tag=a%26b');
        expect(match?.query?.q).toBe('hello world');
    });
});

// ================================================================
describe('Phase38 Chaos: Middleware Chain Stress', () => {
    it('20 middlewares in chain — all execute', async () => {
        const chain = new MiddlewareChain();
        let count = 0;
        for (let i = 0; i < 20; i++) {
            chain.use(`mw-${i}`, async (_, next) => { count++; await next(); });
        }
        await chain.execute(chain.createContext('GET', '/'));
        expect(count).toBe(20);
    });

    it('error in middle — stops subsequent middlewares', async () => {
        const chain = new MiddlewareChain();
        const log: string[] = [];
        chain.use('before', async (_, next) => { log.push('before'); await next(); });
        chain.use('crash', async () => { throw new Error('fail'); });
        chain.use('after', async (_, next) => { log.push('after'); await next(); });

        const result = await chain.execute(chain.createContext('GET', '/'));
        expect(result.response.status).toBe(500);
        expect(log).toContain('before');
        expect(log).not.toContain('after');
    });
});

// ================================================================
describe('Phase38 Chaos: Provider Registry Stress', () => {
    it('20 providers registered — routing accurate', () => {
        const reg = new ProviderRegistry();
        for (let i = 0; i < 20; i++) {
            reg.register(mockProvider(`provider-${i}`), [`model-${i}`], i);
        }
        expect(reg.list()).toHaveLength(20);

        const route = reg.route('model-15');
        expect(route?.provider.id).toBe('provider-15');
    });

    it('toggle health on all providers', () => {
        const reg = new ProviderRegistry();
        for (let i = 0; i < 10; i++) {
            reg.register(mockProvider(`p${i}`), [`m${i}`]);
        }

        // Disable all
        for (let i = 0; i < 10; i++) {
            reg.setHealthy(`p${i}`, false);
        }

        // All routes should fail
        expect(reg.route('m0')).toBeNull();

        // Re-enable one
        reg.setHealthy('p5', true);
        reg.setDefault('p5');
        expect(reg.route('m5')?.provider.id).toBe('p5');
    });
});

// ================================================================
describe('Phase38 Chaos: ResponseBuilder All Status Codes', () => {
    it('common HTTP status codes', () => {
        const codes = [200, 201, 204, 400, 401, 403, 404, 500, 502, 503];
        for (const code of codes) {
            const res = new ResponseBuilder().status(code).json({ code }).build();
            expect(res.status).toBe(code);
            expect(res.statusText).not.toBe('Unknown');
        }
    });
});
