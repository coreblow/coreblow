/**
 * Contract Test: Health Probe Routes
 *
 * Verifikasi behavioral contract dari `handleHealthProbeRequest()` dan
 * `canRevealReadinessDetails()` — tidak peduli implementasi internal.
 *
 * Contracts:
 * 1. /healthz selalu 200 { ok: true, status: "live" }
 * 2. /readyz ready=true selalu 200, ready=false selalu 503
 * 3. Non-probe paths selalu return false (tidak di-handle)
 * 4. POST/PUT/PATCH/DELETE selalu 405 dengan Allow header
 * 5. canRevealReadinessDetails selalu return boolean (tidak throw)
 * 6. HEAD requests tidak memiliki body
 */
import { describe, it, expect } from 'vitest';
import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import {
    handleHealthProbeRequest,
    canRevealReadinessDetails,
    isHealthProbePath,
    HEALTH_PROBE_PATHS,
} from '../../src/gateway/health-probe-routes.js';

function makeMockReq(overrides: {
    method?: string;
    url?: string;
    remoteAddress?: string;
    headers?: Record<string, string>;
} = {}): IncomingMessage {
    return {
        method: overrides.method ?? 'GET',
        url: overrides.url ?? '/healthz',
        socket: { remoteAddress: overrides.remoteAddress ?? '127.0.0.1' } as Socket,
        headers: overrides.headers ?? {},
    } as Partial<IncomingMessage> as IncomingMessage;
}

function makeMockRes() {
    return {
        statusCode: 200,
        headers: {} as Record<string, string>,
        body: undefined as string | undefined,
        setHeader(k: string, v: string) { this.headers[k] = v; },
        end(body?: string) { this.body = body; },
    };
}

describe('isHealthProbePath — contract', () => {
    it('returns true for all registered probe paths', () => {
        for (const path of HEALTH_PROBE_PATHS) {
            expect(isHealthProbePath(path)).toBe(true);
        }
    });

    it('returns false for non-probe paths', () => {
        const nonProbePaths = ['/api/chat', '/api/v1/agents', '/', '/metrics', '/admin'];
        for (const path of nonProbePaths) {
            expect(isHealthProbePath(path)).toBe(false);
        }
    });

    it('HEALTH_PROBE_PATHS contains /healthz and /readyz', () => {
        expect(HEALTH_PROBE_PATHS).toContain('/healthz');
        expect(HEALTH_PROBE_PATHS).toContain('/readyz');
    });
});

describe('handleHealthProbeRequest — status code contract', () => {
    it('/healthz always returns 200', () => {
        const req = makeMockReq({ url: '/healthz' });
        const res = makeMockRes();
        handleHealthProbeRequest(req, res as any, '/healthz');
        expect(res.statusCode).toBe(200);
    });

    it('/health alias always returns 200', () => {
        const req = makeMockReq({ url: '/health' });
        const res = makeMockRes();
        handleHealthProbeRequest(req, res as any, '/health');
        expect(res.statusCode).toBe(200);
    });

    it('/readyz returns 200 when ready', () => {
        const req = makeMockReq({ url: '/readyz' });
        const res = makeMockRes();
        handleHealthProbeRequest(req, res as any, '/readyz', {
            getReadiness: () => ({ ready: true, failing: [], uptimeMs: 1000 }),
        });
        expect(res.statusCode).toBe(200);
    });

    it('/readyz returns 503 when not ready', () => {
        const req = makeMockReq({ url: '/readyz' });
        const res = makeMockRes();
        handleHealthProbeRequest(req, res as any, '/readyz', {
            getReadiness: () => ({ ready: false, failing: ['db'], uptimeMs: 500 }),
        });
        expect(res.statusCode).toBe(503);
    });

    it('non-probe paths return false', () => {
        const req = makeMockReq();
        const res = makeMockRes();
        const handled = handleHealthProbeRequest(req, res as any, '/api/anything');
        expect(handled).toBe(false);
    });

    it('non-GET/HEAD returns 405 with Allow header', () => {
        for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
            const req = makeMockReq({ method });
            const res = makeMockRes();
            handleHealthProbeRequest(req, res as any, '/healthz');
            expect(res.statusCode).toBe(405);
            expect(res.headers['Allow']).toBe('GET, HEAD');
        }
    });
});

describe('handleHealthProbeRequest — body contract', () => {
    it('/healthz body always has ok:true and status', () => {
        const req = makeMockReq();
        const res = makeMockRes();
        handleHealthProbeRequest(req, res as any, '/healthz');
        const body = JSON.parse(res.body ?? '{}');
        expect(body.ok).toBe(true);
        expect(typeof body.status).toBe('string');
    });

    it('/readyz body always has ready field', () => {
        const req = makeMockReq({ url: '/readyz' });
        const res = makeMockRes();
        handleHealthProbeRequest(req, res as any, '/readyz', {
            getReadiness: () => ({ ready: true, failing: [], uptimeMs: 1000 }),
        });
        const body = JSON.parse(res.body ?? '{}');
        expect(typeof body.ready).toBe('boolean');
    });

    it('HEAD request has no body', () => {
        const req = makeMockReq({ method: 'HEAD' });
        const res = makeMockRes();
        handleHealthProbeRequest(req, res as any, '/healthz');
        expect(res.body).toBeUndefined();
    });

    it('Content-Type is always application/json', () => {
        const req = makeMockReq();
        const res = makeMockRes();
        handleHealthProbeRequest(req, res as any, '/healthz');
        expect(res.headers['Content-Type']).toContain('application/json');
    });

    it('Cache-Control is always no-store', () => {
        const req = makeMockReq();
        const res = makeMockRes();
        handleHealthProbeRequest(req, res as any, '/healthz');
        expect(res.headers['Cache-Control']).toBe('no-store');
    });
});

describe('canRevealReadinessDetails — contract', () => {
    it('always returns boolean (never throws)', () => {
        const cases = [
            { remoteAddress: '127.0.0.1', headers: {} },
            { remoteAddress: '::1', headers: {} },
            { remoteAddress: '203.0.113.1', headers: { authorization: 'Bearer token' } },
            { remoteAddress: '1.2.3.4', headers: {} },
        ];

        for (const { remoteAddress, headers } of cases) {
            const req = makeMockReq({ remoteAddress, headers });
            const result = canRevealReadinessDetails(req, { gatewayToken: 'secret' });
            expect(typeof result).toBe('boolean');
        }
    });
});
