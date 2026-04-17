/**
 * Live Test: Gateway Health Probes
 *
 * Verifikasi /healthz dan /readyz terhadap running CoreBlow gateway instance.
 *
 * REQUIRES:
 *   COREBLOW_TEST_URL=http://localhost:3100   — running gateway URL
 *
 * Semua tests di-skip jika env tidak diset (CI safe).
 *
 * Run:
 *   COREBLOW_TEST_URL=http://localhost:3100 npm run test:live
 *
 * @see coreblow/src/agents/anthropic.setup-token.live.test.ts (skipIf pattern)
 */
import { describe, it, expect, beforeAll } from 'vitest';

const GATEWAY_URL = process.env.COREBLOW_TEST_URL?.replace(/\/$/, '');
const GATEWAY_TOKEN = process.env.COREBLOW_TEST_TOKEN;

const skipNoUrl = !GATEWAY_URL;

// ─── Liveness Probe ───────────────────────────────────────────────────────────

describe.skipIf(skipNoUrl)('Live: GET /healthz (liveness)', () => {
    it('returns 200 OK', async () => {
        const res = await fetch(`${GATEWAY_URL}/healthz`);
        expect(res.status).toBe(200);
    });

    it('returns { ok: true, status: "live" }', async () => {
        const res = await fetch(`${GATEWAY_URL}/healthz`);
        const body = await res.json() as Record<string, unknown>;
        expect(body.ok).toBe(true);
        expect(body.status).toBe('live');
    });

    it('sets Cache-Control: no-store', async () => {
        const res = await fetch(`${GATEWAY_URL}/healthz`);
        expect(res.headers.get('cache-control')).toBe('no-store');
    });

    it('sets Content-Type: application/json', async () => {
        const res = await fetch(`${GATEWAY_URL}/healthz`);
        expect(res.headers.get('content-type')).toContain('application/json');
    });

    it('/health alias also returns 200', async () => {
        const res = await fetch(`${GATEWAY_URL}/health`);
        expect(res.status).toBe(200);
    });

    it('HEAD /healthz returns 200 without body', async () => {
        const res = await fetch(`${GATEWAY_URL}/healthz`, { method: 'HEAD' });
        expect(res.status).toBe(200);
        // HEAD response has no body
        const text = await res.text();
        expect(text).toBe('');
    });

    it('POST /healthz returns 405 Method Not Allowed', async () => {
        const res = await fetch(`${GATEWAY_URL}/healthz`, { method: 'POST' });
        expect(res.status).toBe(405);
        expect(res.headers.get('allow')).toContain('GET');
    });
});

// ─── Readiness Probe ──────────────────────────────────────────────────────────

describe.skipIf(skipNoUrl)('Live: GET /readyz (readiness)', () => {
    it('returns 200 or 503 (gateway is up even if subsystem failing)', async () => {
        const res = await fetch(`${GATEWAY_URL}/readyz`);
        expect([200, 503]).toContain(res.status);
    });

    it('body contains ready field (boolean)', async () => {
        const res = await fetch(`${GATEWAY_URL}/readyz`);
        const body = await res.json() as Record<string, unknown>;
        expect(typeof body.ready).toBe('boolean');
    });

    it('/ready alias also works', async () => {
        const res = await fetch(`${GATEWAY_URL}/ready`);
        expect([200, 503]).toContain(res.status);
    });

    it('anonymous external request hides failing details when not ready', async () => {
        const res = await fetch(`${GATEWAY_URL}/readyz`);
        if (res.status === 503) {
            // External anonymous → should NOT have failing array
            const body = await res.json() as Record<string, unknown>;
            expect(body.failing).toBeUndefined();
        }
    });
});

// ─── Readiness with Auth ──────────────────────────────────────────────────────

const skipNoToken = skipNoUrl || !GATEWAY_TOKEN;

describe.skipIf(skipNoToken)('Live: GET /readyz with auth token', () => {
    it('authenticated request gets full readiness detail', async () => {
        const res = await fetch(`${GATEWAY_URL}/readyz`, {
            headers: { Authorization: `Bearer ${GATEWAY_TOKEN}` },
        });
        const body = await res.json() as Record<string, unknown>;
        expect(typeof body.ready).toBe('boolean');

        if (res.status === 200) {
            // Ready → full detail: uptimeMs, failing array
            expect(typeof body.uptimeMs).toBe('number');
            expect(Array.isArray(body.failing)).toBe(true);
        } else if (res.status === 503) {
            // Not ready → failing details revealed to authenticated request
            expect(Array.isArray(body.failing)).toBe(true);
        }
    });
});
