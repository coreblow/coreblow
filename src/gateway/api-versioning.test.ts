import { describe, it, expect, beforeEach } from 'vitest';
import { ApiVersioning } from './api-versioning.js';

describe('ApiVersioning', () => {
    let versioning: ApiVersioning;

    beforeEach(() => {
        versioning = new ApiVersioning();
    });

    // === Defaults ===

    describe('constructor defaults', () => {
        it('registers v1 as current', () => {
            const list = versioning.list();
            expect(list).toHaveLength(1);
            expect(list[0]!.version).toBe('v1');
            expect(list[0]!.status).toBe('current');
        });

        it('v1 has default routes', () => {
            const routes = versioning.getRoutes('v1');
            expect(routes.length).toBeGreaterThanOrEqual(3);
            const paths = routes.map(r => r.path);
            expect(paths).toContain('/chat');
            expect(paths).toContain('/models');
            expect(paths).toContain('/health');
        });
    });

    // === Negotiation ===

    describe('negotiate', () => {
        it('returns v1 by default', () => {
            const result = versioning.negotiate();
            expect(result.version).toBe('v1');
            expect(result.status).toBe('current');
            expect(result.warnings).toHaveLength(0);
        });

        it('returns requested version if registered', () => {
            const result = versioning.negotiate('v1');
            expect(result.version).toBe('v1');
        });

        it('falls back to default for unknown version', () => {
            const result = versioning.negotiate('v99');
            expect(result.version).toBe('v1');
            expect(result.warnings[0]).toContain('Unknown version');
        });

        it('warns for deprecated version', () => {
            versioning.deprecate('v1', Date.now() + 86400000);
            const result = versioning.negotiate('v1');
            expect(result.warnings[0]).toContain('deprecated');
            expect(result.warnings[0]).toContain('Sunset');
        });

        it('falls back for removed version', () => {
            versioning.registerVersion({
                version: 'v2', status: 'current',
                releaseDate: Date.now(), routes: new Map(),
            });
            versioning.setDefault('v2');
            versioning.registerVersion({
                version: 'v0', status: 'removed',
                releaseDate: Date.now() - 86400000, routes: new Map(),
            });

            const result = versioning.negotiate('v0');
            expect(result.version).toBe('v2');
            expect(result.warnings[0]).toContain('removed');
        });
    });

    // === Route Resolution ===

    describe('resolveRoute', () => {
        it('finds a registered route', () => {
            const route = versioning.resolveRoute('v1', '/chat');
            expect(route?.handler).toBe('chat');
            expect(route?.method).toBe('POST');
        });

        it('returns null for unknown route', () => {
            expect(versioning.resolveRoute('v1', '/nonexistent')).toBeNull();
        });

        it('returns null for unknown version', () => {
            expect(versioning.resolveRoute('v99', '/chat')).toBeNull();
        });
    });

    // === Version Registration ===

    describe('registerVersion', () => {
        it('adds a new version', () => {
            versioning.registerVersion({
                version: 'v2', status: 'supported',
                releaseDate: Date.now(), routes: new Map([
                    ['/stream', { path: '/stream', method: 'POST', handler: 'stream' }],
                ]),
            });
            expect(versioning.count()).toBe(2);
            expect(versioning.getRoutes('v2')).toHaveLength(1);
        });
    });

    // === Deprecation ===

    describe('deprecate', () => {
        it('marks version as deprecated', () => {
            expect(versioning.deprecate('v1')).toBe(true);
            const list = versioning.list();
            expect(list[0]!.status).toBe('deprecated');
        });

        it('returns false for non-existent version', () => {
            expect(versioning.deprecate('v99')).toBe(false);
        });
    });

    // === Default ===

    describe('setDefault', () => {
        it('changes the default version', () => {
            versioning.registerVersion({
                version: 'v2', status: 'current',
                releaseDate: Date.now(), routes: new Map(),
            });
            expect(versioning.setDefault('v2')).toBe(true);
            expect(versioning.negotiate().version).toBe('v2');
        });

        it('returns false for non-existent version', () => {
            expect(versioning.setDefault('v99')).toBe(false);
        });
    });

    // === Listing ===

    describe('list', () => {
        it('includes route count', () => {
            const list = versioning.list();
            expect(list[0]!.routeCount).toBeGreaterThanOrEqual(3);
        });
    });
});
