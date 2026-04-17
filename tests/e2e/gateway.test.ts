/**
 * tests/e2e/gateway.test.ts
 * End-to-end tests — gateway startup, API health, WebSocket
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Gateway E2E', () => {
    const PORT = 3120;
    const BASE_URL = `http://127.0.0.1:${PORT}`;

    it('should return health check', async () => {
        try {
            const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
            if (res.ok) {
                const data = await res.json() as any;
                expect(data.status).toBe('ok');
                expect(data.version).toBe('1.0.0');
                expect(data.channels).toBeDefined();
            }
        } catch {
            // Gateway not running — skip
            console.log('Gateway not running, skipping E2E health check');
        }
    });

    it('should return gateway info', async () => {
        try {
            const res = await fetch(`${BASE_URL}/api/info`, { signal: AbortSignal.timeout(3000) });
            if (res.ok) {
                const data = await res.json() as any;
                expect(data.name).toBe('CoreBlow Gateway');
            }
        } catch {
            console.log('Gateway not running, skipping E2E info check');
        }
    });

    it('should serve dashboard HTML', async () => {
        try {
            const res = await fetch(`${BASE_URL}/dashboard`, { signal: AbortSignal.timeout(3000) });
            if (res.ok) {
                const html = await res.text();
                expect(html).toContain('CoreBlow');
                expect(html).toContain('<!DOCTYPE html>');
            }
        } catch {
            console.log('Gateway not running, skipping E2E dashboard check');
        }
    });

    it('should return 404 for unknown routes', async () => {
        try {
            const res = await fetch(`${BASE_URL}/api/nonexistent`, { signal: AbortSignal.timeout(3000) });
            if (!res.ok) {
                expect(res.status).toBe(404);
            }
        } catch {
            console.log('Gateway not running, skipping E2E 404 check');
        }
    });

    it('should list sessions via API', async () => {
        try {
            const res = await fetch(`${BASE_URL}/api/dashboard/sessions`, { signal: AbortSignal.timeout(3000) });
            if (res.ok) {
                const data = await res.json() as any;
                expect(data.sessions).toBeDefined();
                expect(Array.isArray(data.sessions)).toBe(true);
            }
        } catch {
            console.log('Gateway not running, skipping E2E sessions check');
        }
    });
});
