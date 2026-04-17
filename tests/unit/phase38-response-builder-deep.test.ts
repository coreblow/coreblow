/**
 * CoreBlow Phase 38 — ResponseBuilder Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - Fluent API, status codes, headers, JSON/text/HTML body
 *   - Static factory methods
 */
import { describe, it, expect } from 'vitest';
import { ResponseBuilder } from '../../src/gateway/response-builder.js';

describe('ResponseBuilder — Extended', () => {
    it('should build default 200 JSON response', () => {
        const res = new ResponseBuilder().json({ ok: true }).build();
        expect(res.status).toBe(200);
        expect(res.statusText).toBe('OK');
        expect(res.headers['Content-Type']).toBe('application/json');
        expect(res.body).toEqual({ ok: true });
    });

    it('should chain status and headers', () => {
        const res = new ResponseBuilder()
            .status(201)
            .header('X-Request-Id', 'abc-123')
            .json({ id: 1 })
            .build();
        expect(res.status).toBe(201);
        expect(res.statusText).toBe('Created');
        expect(res.headers['X-Request-Id']).toBe('abc-123');
    });

    it('should build text response', () => {
        const res = new ResponseBuilder().text('Hello World').build();
        expect(res.headers['Content-Type']).toBe('text/plain');
        expect(res.serialized).toBe('Hello World');
    });

    it('should build HTML response', () => {
        const res = new ResponseBuilder().html('<h1>Hello</h1>').build();
        expect(res.headers['Content-Type']).toBe('text/html');
        expect(res.serialized).toContain('<h1>');
    });

    it('should serialize JSON body', () => {
        const res = new ResponseBuilder().json({ a: 1, b: 'two' }).build();
        expect(res.serialized).toBe('{"a":1,"b":"two"}');
    });

    it('should handle error status codes', () => {
        const res = new ResponseBuilder().status(404).json({ error: 'Not Found' }).build();
        expect(res.statusText).toBe('Not Found');
    });

    it('should handle unknown status codes', () => {
        const res = new ResponseBuilder().status(418).build();
        expect(res.statusText).toBe('Unknown');
    });

    // Static factory methods
    it('static ok()', () => {
        const res = ResponseBuilder.ok({ success: true });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true });
    });

    it('static created()', () => {
        const res = ResponseBuilder.created({ id: 42 });
        expect(res.status).toBe(201);
    });

    it('static notFound()', () => {
        const res = ResponseBuilder.notFound('User not found');
        expect(res.status).toBe(404);
        expect((res.body as any).error).toBe('User not found');
    });

    it('static error()', () => {
        const res = ResponseBuilder.error('Server crashed', 503);
        expect(res.status).toBe(503);
        expect((res.body as any).error).toBe('Server crashed');
    });

    it('static error() default', () => {
        const res = ResponseBuilder.error();
        expect(res.status).toBe(500);
    });
});
