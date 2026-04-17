/**
 * Tests: Health Probe Routes — canRevealReadinessDetails
 *
 * Port pola dari coreblow/src/gateway/server-http.probe.test.ts.
 * Verifikasi bahwa detail readiness hanya dikembalikan kepada request
 * yang berhak (loopback atau token valid), bukan open external.
 */
import { describe, it, expect } from 'vitest';
import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import {
    canRevealReadinessDetails,
    handleHealthProbeRequest,
} from '../../src/gateway/health-probe-routes.js';
import type { ReadinessChecker } from '../../src/gateway/health-probe-routes.js';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function makeMockReq(overrides: {
    remoteAddress?: string;
    headers?: Record<string, string>;
} = {}): IncomingMessage {
    const headers = overrides.headers ?? {};
    return {
        socket: {
            remoteAddress: overrides.remoteAddress ?? '1.2.3.4',
        } as Partial<Socket> as Socket,
        headers,
        method: 'GET',
        url: '/readyz',
    } as Partial<IncomingMessage> as IncomingMessage;
}

function makeMockRes(): {
    statusCode: number;
    headers: Record<string, string>;
    body: string | undefined;
    setHeader: (k: string, v: string) => void;
    end: (body?: string) => void;
} {
    const res = {
        statusCode: 200,
        headers: {} as Record<string, string>,
        body: undefined as string | undefined,
        setHeader(k: string, v: string) { this.headers[k] = v; },
        end(body?: string) { this.body = body; },
    };
    return res;
}

// ─── canRevealReadinessDetails tests ──────────────────────────────────────────

describe('canRevealReadinessDetails', () => {
    describe('Rule 1: loopback → always reveal', () => {
        it('reveals for 127.0.0.1 without forwarding headers', () => {
            const req = makeMockReq({ remoteAddress: '127.0.0.1' });
            expect(canRevealReadinessDetails(req, { gatewayToken: 'secret' })).toBe(true);
        });

        it('reveals for ::1 (IPv6 loopback)', () => {
            const req = makeMockReq({ remoteAddress: '::1' });
            expect(canRevealReadinessDetails(req, {})).toBe(true);
        });

        it('reveals for ::ffff:127.0.0.1 (IPv4-mapped loopback)', () => {
            const req = makeMockReq({ remoteAddress: '::ffff:127.0.0.1' });
            expect(canRevealReadinessDetails(req, {})).toBe(true);
        });

        it('reveals for 127.x.x.x range', () => {
            const req = makeMockReq({ remoteAddress: '127.0.0.255' });
            expect(canRevealReadinessDetails(req, {})).toBe(true);
        });

        it('does NOT reveal loopback with x-forwarded-for (proxy spoofing)', () => {
            const req = makeMockReq({
                remoteAddress: '127.0.0.1',
                headers: { 'x-forwarded-for': '10.0.0.1' },
            });
            // Loopback + forwarding header → not a direct local request
            expect(canRevealReadinessDetails(req, { gatewayToken: 'secret' })).toBe(false);
        });

        it('does NOT reveal loopback with x-real-ip header', () => {
            const req = makeMockReq({
                remoteAddress: '127.0.0.1',
                headers: { 'x-real-ip': '203.0.113.1' },
            });
            expect(canRevealReadinessDetails(req, { gatewayToken: 'secret' })).toBe(false);
        });
    });

    describe('Rule 2: no auth configured → hide for external', () => {
        it('hides for non-loopback when gatewayToken not set', () => {
            const req = makeMockReq({ remoteAddress: '10.0.0.1' });
            expect(canRevealReadinessDetails(req, {})).toBe(false);
        });

        it('hides for non-loopback when gatewayToken is empty string', () => {
            const req = makeMockReq({ remoteAddress: '203.0.113.1' });
            // Empty string is falsy → treated as "no auth"
            expect(canRevealReadinessDetails(req, { gatewayToken: '' })).toBe(false);
        });
    });

    describe('Rule 3: valid bearer token → reveal', () => {
        it('reveals when bearer token matches gatewayToken', () => {
            const req = makeMockReq({
                remoteAddress: '203.0.113.1',
                headers: { authorization: 'Bearer my-secret-token' },
            });
            expect(canRevealReadinessDetails(req, { gatewayToken: 'my-secret-token' })).toBe(true);
        });

        it('is case-insensitive for Bearer prefix', () => {
            const req = makeMockReq({
                remoteAddress: '203.0.113.1',
                headers: { authorization: 'BEARER my-secret-token' },
            });
            expect(canRevealReadinessDetails(req, { gatewayToken: 'my-secret-token' })).toBe(true);
        });

        it('hides when bearer token does NOT match', () => {
            const req = makeMockReq({
                remoteAddress: '203.0.113.1',
                headers: { authorization: 'Bearer wrong-token' },
            });
            expect(canRevealReadinessDetails(req, { gatewayToken: 'correct-token' })).toBe(false);
        });

        it('hides when no Authorization header', () => {
            const req = makeMockReq({ remoteAddress: '203.0.113.1' });
            expect(canRevealReadinessDetails(req, { gatewayToken: 'secret' })).toBe(false);
        });

        it('hides for non-Bearer auth scheme', () => {
            const req = makeMockReq({
                remoteAddress: '203.0.113.1',
                headers: { authorization: 'Basic dXNlcjpwYXNz' },
            });
            expect(canRevealReadinessDetails(req, { gatewayToken: 'secret' })).toBe(false);
        });
    });
});

// ─── handleHealthProbeRequest /readyz tests ───────────────────────────────────

describe('handleHealthProbeRequest /readyz — detail visibility', () => {
    const readyChecker: ReadinessChecker = () => ({
        ready: true, failing: [], uptimeMs: 5000,
    });

    const notReadyChecker: ReadinessChecker = () => ({
        ready: false, failing: ['database'], uptimeMs: 1000,
    });

    it('returns full detail to loopback request (ready)', () => {
        const req = makeMockReq({ remoteAddress: '127.0.0.1' });
        const res = makeMockRes();
        handleHealthProbeRequest(req as IncomingMessage, res as unknown as any, '/readyz', {
            getReadiness: readyChecker,
            auth: { gatewayToken: 'secret' },
        });
        const body = JSON.parse(res.body ?? '{}');
        expect(body.ready).toBe(true);
        expect(body.uptimeMs).toBeDefined();
        expect(body.failing).toBeDefined();
    });

    it('returns full detail to loopback request (not ready)', () => {
        const req = makeMockReq({ remoteAddress: '127.0.0.1' });
        const res = makeMockRes();
        handleHealthProbeRequest(req as IncomingMessage, res as unknown as any, '/readyz', {
            getReadiness: notReadyChecker,
            auth: {},
        });
        const body = JSON.parse(res.body ?? '{}');
        expect(body.ready).toBe(false);
        expect(body.failing).toEqual(['database']);  // detail revealed
        expect(res.statusCode).toBe(503);
    });

    it('hides failing details from anonymous external request', () => {
        const req = makeMockReq({ remoteAddress: '203.0.113.1' });
        const res = makeMockRes();
        handleHealthProbeRequest(req as IncomingMessage, res as unknown as any, '/readyz', {
            getReadiness: notReadyChecker,
            auth: { gatewayToken: 'secret' },
        });
        const body = JSON.parse(res.body ?? '{}');
        expect(body.ready).toBe(false);
        expect(body.failing).toBeUndefined();  // hidden!
        expect(body.uptimeMs).toBeUndefined(); // hidden!
        expect(res.statusCode).toBe(503);
    });

    it('reveals details to authenticated external request', () => {
        const req = makeMockReq({
            remoteAddress: '203.0.113.1',
            headers: { authorization: 'Bearer secret' },
        });
        const res = makeMockRes();
        handleHealthProbeRequest(req as IncomingMessage, res as unknown as any, '/readyz', {
            getReadiness: notReadyChecker,
            auth: { gatewayToken: 'secret' },
        });
        const body = JSON.parse(res.body ?? '{}');
        expect(body.ready).toBe(false);
        expect(body.failing).toEqual(['database']);  // revealed!
    });

    it('/healthz always returns { ok: true, status: "live" }', () => {
        const req = makeMockReq({ remoteAddress: '1.2.3.4' });
        const res = makeMockRes();
        handleHealthProbeRequest(req as IncomingMessage, res as unknown as any, '/healthz', {
            getReadiness: notReadyChecker,
        });
        const body = JSON.parse(res.body ?? '{}');
        expect(body.ok).toBe(true);
        expect(body.status).toBe('live');
        expect(res.statusCode).toBe(200);
    });

    it('returns false for non-probe paths', () => {
        const req = makeMockReq();
        const res = makeMockRes();
        const handled = handleHealthProbeRequest(req as IncomingMessage, res as unknown as any, '/api/chat');
        expect(handled).toBe(false);
    });

    it('returns 405 for POST to probe endpoint', () => {
        const req = { ...makeMockReq(), method: 'POST' } as IncomingMessage;
        const res = makeMockRes();
        handleHealthProbeRequest(req, res as unknown as any, '/healthz');
        expect(res.statusCode).toBe(405);
    });
});
