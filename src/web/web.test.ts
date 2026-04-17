/**
 * Web API Tests — Phase D: Remaining Modules
 * Tests: jsonResponse, errorResponse
 */
import { describe, it, expect } from 'vitest';
import { jsonResponse, errorResponse } from './api-response.js';

describe('jsonResponse', () => {
    it('creates 200 response', () => {
        const res = jsonResponse({ ok: true });
        expect(res.status).toBe(200);
        expect(res.headers['Content-Type']).toBe('application/json');
        expect(JSON.parse(res.body)).toEqual({ ok: true });
    });

    it('creates custom status', () => {
        const res = jsonResponse({ created: true }, 201);
        expect(res.status).toBe(201);
    });

    it('serializes arrays', () => {
        const res = jsonResponse([1, 2, 3]);
        expect(JSON.parse(res.body)).toEqual([1, 2, 3]);
    });

    it('serializes null', () => {
        const res = jsonResponse(null);
        expect(JSON.parse(res.body)).toBeNull();
    });

    it('serializes nested objects', () => {
        const res = jsonResponse({ a: { b: { c: 1 } } });
        expect(JSON.parse(res.body).a.b.c).toBe(1);
    });
});

describe('errorResponse', () => {
    it('creates 500 error by default', () => {
        const res = errorResponse('Internal Server Error');
        expect(res.status).toBe(500);
        expect(JSON.parse(res.body).error).toBe('Internal Server Error');
    });

    it('creates custom error status', () => {
        const res = errorResponse('Not Found', 404);
        expect(res.status).toBe(404);
    });

    it('creates 400 bad request', () => {
        const res = errorResponse('Bad Request', 400);
        expect(res.status).toBe(400);
    });

    it('creates 401 unauthorized', () => {
        const res = errorResponse('Unauthorized', 401);
        expect(res.status).toBe(401);
    });

    it('creates 429 rate limited', () => {
        const res = errorResponse('Rate Limited', 429);
        expect(res.status).toBe(429);
    });
});
