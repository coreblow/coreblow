/**
 * CoreBlow — Route Matcher Tests
 *
 * Tests for route registration, path matching with params,
 * wildcards, query parsing, and method filtering.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RouteMatcher } from './route-matcher.js';

describe('RouteMatcher', () => {
    let router: RouteMatcher;

    beforeEach(() => {
        router = new RouteMatcher();
    });

    describe('add + match', () => {
        it('matches exact path', () => {
            router.get('/api/health', 'health-handler');
            const match = router.match('GET', '/api/health');
            expect(match).not.toBeNull();
            expect(match!.route.handler).toBe('health-handler');
        });

        it('returns null for unregistered path', () => {
            router.get('/api/health', 'h');
            expect(router.match('GET', '/api/missing')).toBeNull();
        });

        it('is case-insensitive for method', () => {
            router.get('/test', 'h');
            expect(router.match('get', '/test')).not.toBeNull();
            expect(router.match('GET', '/test')).not.toBeNull();
        });

        it('rejects wrong method', () => {
            router.get('/test', 'h');
            expect(router.match('POST', '/test')).toBeNull();
        });
    });

    describe('path parameters', () => {
        it('extracts named params', () => {
            router.get('/api/users/:id', 'user-handler');
            const match = router.match('GET', '/api/users/123');
            expect(match!.params).toEqual({ id: '123' });
        });

        it('extracts multiple params', () => {
            router.get('/api/:entity/:id', 'entity-handler');
            const match = router.match('GET', '/api/posts/42');
            expect(match!.params).toEqual({ entity: 'posts', id: '42' });
        });
    });

    describe('wildcards', () => {
        it('matches wildcard route', () => {
            router.get('/static/*', 'static-handler');
            const match = router.match('GET', '/static/css/style.css');
            expect(match).not.toBeNull();
            expect(match!.route.handler).toBe('static-handler');
        });

        it('does not match shorter path than wildcard prefix', () => {
            router.get('/api/v1/*', 'handler');
            expect(router.match('GET', '/api')).toBeNull();
        });
    });

    describe('query parsing', () => {
        it('parses query string', () => {
            router.get('/search', 'search-handler');
            const match = router.match('GET', '/search?q=hello&page=2');
            expect(match!.query).toEqual({ q: 'hello', page: '2' });
        });

        it('URL-decodes query values', () => {
            router.get('/search', 'h');
            const match = router.match('GET', '/search?q=hello%20world');
            expect(match!.query).toEqual({ q: 'hello world' });
        });
    });

    describe('convenience methods', () => {
        it('supports POST', () => {
            router.post('/api/data', 'post-handler');
            expect(router.match('POST', '/api/data')?.route.handler).toBe('post-handler');
        });

        it('supports PUT', () => {
            router.put('/api/data/:id', 'put-handler');
            expect(router.match('PUT', '/api/data/1')?.route.handler).toBe('put-handler');
        });

        it('supports DELETE', () => {
            router.delete('/api/data/:id', 'del-handler');
            expect(router.match('DELETE', '/api/data/1')?.route.handler).toBe('del-handler');
        });
    });

    describe('list + count', () => {
        it('lists all routes', () => {
            router.get('/a', 'ha');
            router.post('/b', 'hb');
            expect(router.list()).toHaveLength(2);
        });

        it('counts routes', () => {
            router.get('/x', 'hx');
            expect(router.count()).toBe(1);
        });
    });
});
