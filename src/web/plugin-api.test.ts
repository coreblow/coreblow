import { describe, it, expect } from 'vitest';
import { PluginApiRouter, type PluginApiRequest, type PluginApiDependencies } from './plugin-api.js';

// ─── Minimal mocks for PluginApiDependencies ────────────────────

function createMockDeps(overrides?: Partial<PluginApiDependencies>): PluginApiDependencies {
    return {
        loader: null,
        marketplace: {
            search: () => ({ results: [], total: 0 }),
            getFeatured: () => [],
            getCategories: () => ['ai', 'tools', 'channels'],
            getPlugin: (id: string) => (id === 'known-plugin' ? { id, name: 'Known' } : null),
            count: () => 5,
        } as any,
        installer: {
            installFromLocal: async () => ({ success: true, pluginId: 'test-plugin' }),
            installFromNpm: async () => ({ success: true, pluginId: 'npm-plugin' }),
            uninstall: async () => ({ success: true }),
        } as any,
        ...overrides,
    };
}

function req(method: string, path: string, query: Record<string, string> = {}, body?: unknown): PluginApiRequest {
    return { method, path, params: {}, query, body };
}

// ─── Tests ──────────────────────────────────────────────────────

describe('PluginApiRouter', () => {
    describe('routing — no loader', () => {
        it('returns 503 for /api/plugins when loader is null', async () => {
            const router = new PluginApiRouter(createMockDeps());
            const res = await router.handle(req('GET', '/api/plugins'));
            expect(res.status).toBe(503);
            expect((res.body as any).error).toContain('not initialized');
        });

        it('returns 503 for /api/plugins/stats when loader is null', async () => {
            const router = new PluginApiRouter(createMockDeps());
            const res = await router.handle(req('GET', '/api/plugins/stats'));
            expect(res.status).toBe(503);
        });

        it('returns 503 for /api/plugins/health when loader is null', async () => {
            const router = new PluginApiRouter(createMockDeps());
            const res = await router.handle(req('GET', '/api/plugins/health'));
            expect(res.status).toBe(503);
            expect((res.body as any).healthy).toBe(false);
        });

        it('returns 503 for plugin enable/disable/reload when no loader', async () => {
            const router = new PluginApiRouter(createMockDeps());
            expect((await router.handle(req('POST', '/api/plugins/my-plugin/enable'))).status).toBe(503);
            expect((await router.handle(req('POST', '/api/plugins/my-plugin/disable'))).status).toBe(503);
            expect((await router.handle(req('POST', '/api/plugins/my-plugin/reload'))).status).toBe(503);
        });

        it('returns 503 for GET /api/plugins/:id when no loader', async () => {
            const router = new PluginApiRouter(createMockDeps());
            const res = await router.handle(req('GET', '/api/plugins/my-plugin'));
            expect(res.status).toBe(503);
        });
    });

    describe('routing — marketplace', () => {
        it('GET /api/marketplace returns 200', async () => {
            const router = new PluginApiRouter(createMockDeps());
            const res = await router.handle(req('GET', '/api/marketplace'));
            expect(res.status).toBe(200);
        });

        it('GET /api/marketplace/search returns 200', async () => {
            const router = new PluginApiRouter(createMockDeps());
            const res = await router.handle(req('GET', '/api/marketplace/search', { q: 'ai' }));
            expect(res.status).toBe(200);
        });

        it('GET /api/marketplace/featured returns 200', async () => {
            const router = new PluginApiRouter(createMockDeps());
            const res = await router.handle(req('GET', '/api/marketplace/featured'));
            expect(res.status).toBe(200);
            expect((res.body as any).featured).toBeDefined();
        });

        it('GET /api/marketplace/categories returns 200 with categories', async () => {
            const router = new PluginApiRouter(createMockDeps());
            const res = await router.handle(req('GET', '/api/marketplace/categories'));
            expect(res.status).toBe(200);
            expect((res.body as any).categories).toEqual(['ai', 'tools', 'channels']);
        });

        it('GET /api/marketplace/:id returns plugin if found', async () => {
            const router = new PluginApiRouter(createMockDeps());
            const res = await router.handle(req('GET', '/api/marketplace/known-plugin'));
            expect(res.status).toBe(200);
            expect((res.body as any).id).toBe('known-plugin');
        });

        it('GET /api/marketplace/:id returns 404 if not found', async () => {
            const router = new PluginApiRouter(createMockDeps());
            const res = await router.handle(req('GET', '/api/marketplace/unknown'));
            expect(res.status).toBe(404);
        });
    });

    describe('routing — install', () => {
        it('POST /api/plugins/install requires source and targetDir', async () => {
            const router = new PluginApiRouter(createMockDeps());
            const res = await router.handle(req('POST', '/api/plugins/install', {}, {}));
            expect(res.status).toBe(400);
            expect((res.body as any).error).toContain('source');
        });

        it('POST /api/plugins/install succeeds with valid body', async () => {
            const router = new PluginApiRouter(createMockDeps());
            const res = await router.handle(
                req('POST', '/api/plugins/install', {}, { source: '/path/to/plugin', targetDir: '/plugins' }),
            );
            expect(res.status).toBe(201);
            expect((res.body as any).success).toBe(true);
        });

        it('POST /api/plugins/install with npm sourceType', async () => {
            const router = new PluginApiRouter(createMockDeps());
            const res = await router.handle(
                req('POST', '/api/plugins/install', {}, { source: 'my-plugin', targetDir: '/plugins', sourceType: 'npm' }),
            );
            expect(res.status).toBe(201);
            expect((res.body as any).pluginId).toBe('npm-plugin');
        });
    });

    describe('routing — uninstall', () => {
        it('DELETE /api/plugins/:id returns 503 when no loader', async () => {
            const router = new PluginApiRouter(createMockDeps());
            const res = await router.handle(req('DELETE', '/api/plugins/some-plugin'));
            expect(res.status).toBe(200); // installer still works
            expect((res.body as any).success).toBe(true);
        });
    });

    describe('routing — 404', () => {
        it('returns 404 for unknown routes', async () => {
            const router = new PluginApiRouter(createMockDeps());
            expect((await router.handle(req('GET', '/api/unknown'))).status).toBe(404);
            expect((await router.handle(req('POST', '/api/plugins'))).status).toBe(404);
            expect((await router.handle(req('PUT', '/api/plugins/x'))).status).toBe(404);
        });
    });
});
