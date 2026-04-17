/**
 * CoreBlow Phase 38 — Route→Middleware→Response Pipeline Chain Tests
 *
 * Layer 2 (Pipeline):
 *   RouteMatcher.match → MiddlewareChain.execute → ResponseBuilder.build
 */
import { describe, it, expect } from 'vitest';
import { RouteMatcher } from '../../src/gateway/route-matcher.js';
import { MiddlewareChain } from '../../src/gateway/middleware-chain.js';
import { ResponseBuilder } from '../../src/gateway/response-builder.js';

describe('Phase38 Chain: Route→Middleware→Response Pipeline', () => {

    it('match route → execute middleware → build response', async () => {
        // Step 1: Route matching
        const router = new RouteMatcher();
        router.get('/api/users/:id', 'getUser');

        const match = router.match('GET', '/api/users/42?fields=name,email');
        expect(match).not.toBeNull();
        expect(match?.params.id).toBe('42');

        // Step 2: Middleware execution
        const chain = new MiddlewareChain();
        chain.use('auth', async (ctx, next) => {
            ctx.state.authenticated = true;
            await next();
        });
        chain.use('handler', async (ctx) => {
            ctx.response.body = {
                user: { id: match?.params.id, auth: ctx.state.authenticated },
            };
        });

        const ctx = chain.createContext('GET', '/api/users/42');
        const result = await chain.execute(ctx);

        // Step 3: Response building
        const response = ResponseBuilder.ok(result.response.body);
        expect(response.status).toBe(200);
        expect((response.body as any).user.id).toBe('42');
        expect((response.body as any).user.auth).toBe(true);
    });

    it('unmatched route → 404 response', () => {
        const router = new RouteMatcher();
        router.get('/api/v1/data', 'handler');

        const match = router.match('GET', '/api/v2/data');
        expect(match).toBeNull();

        const response = ResponseBuilder.notFound('Route not found');
        expect(response.status).toBe(404);
    });

    it('middleware error → 500 response with error details', async () => {
        const chain = new MiddlewareChain();
        chain.use('failing', async () => { throw new Error('Database connection failed'); });

        const ctx = chain.createContext('POST', '/api/data');
        const result = await chain.execute(ctx);

        const response = ResponseBuilder.error(
            (result.response.body as any)?.error ?? 'Unknown error',
            result.response.status,
        );
        expect(response.status).toBe(500);
    });
});
