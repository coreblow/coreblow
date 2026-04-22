/**
 * CoreBlow — Response Builder Tests
 *
 * Tests for fluent API, content types, static factories,
 * status texts, and serialization.
 */

import { describe, it, expect } from 'vitest';
import { ResponseBuilder } from './response-builder.js';

describe('ResponseBuilder', () => {
    describe('fluent API', () => {
        it('builds default 200 JSON response', () => {
            const res = new ResponseBuilder().json({ ok: true }).build();
            expect(res.status).toBe(200);
            expect(res.statusText).toBe('OK');
            expect(res.headers['Content-Type']).toBe('application/json');
            expect(res.body).toEqual({ ok: true });
        });

        it('chains status + header + json', () => {
            const res = new ResponseBuilder()
                .status(201)
                .header('X-Custom', 'test')
                .json({ id: 1 })
                .build();
            expect(res.status).toBe(201);
            expect(res.headers['X-Custom']).toBe('test');
        });

        it('sets text content type', () => {
            const res = new ResponseBuilder().text('hello').build();
            expect(res.headers['Content-Type']).toBe('text/plain');
            expect(res.body).toBe('hello');
            expect(res.serialized).toBe('hello');
        });

        it('sets HTML content type', () => {
            const res = new ResponseBuilder().html('<h1>Hi</h1>').build();
            expect(res.headers['Content-Type']).toBe('text/html');
        });

        it('serializes JSON body', () => {
            const res = new ResponseBuilder().json({ a: 1 }).build();
            expect(res.serialized).toBe('{"a":1}');
        });
    });

    describe('status texts', () => {
        it.each([
            [200, 'OK'], [201, 'Created'], [204, 'No Content'],
            [400, 'Bad Request'], [401, 'Unauthorized'], [403, 'Forbidden'],
            [404, 'Not Found'], [500, 'Internal Server Error'],
            [502, 'Bad Gateway'], [503, 'Service Unavailable'],
        ])('status %d → %s', (code, text) => {
            const res = new ResponseBuilder().status(code).build();
            expect(res.statusText).toBe(text);
        });

        it('returns "Unknown" for unmapped status', () => {
            const res = new ResponseBuilder().status(418).build();
            expect(res.statusText).toBe('Unknown');
        });
    });

    describe('static factories', () => {
        it('ok() returns 200', () => {
            const res = ResponseBuilder.ok({ data: 'test' });
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ data: 'test' });
        });

        it('created() returns 201', () => {
            expect(ResponseBuilder.created({ id: 1 }).status).toBe(201);
        });

        it('notFound() returns 404', () => {
            const res = ResponseBuilder.notFound('Resource missing');
            expect(res.status).toBe(404);
            expect(res.body).toEqual({ error: 'Resource missing' });
        });

        it('notFound() uses default message', () => {
            expect((ResponseBuilder.notFound().body as any).error).toBe('Not Found');
        });

        it('error() returns 500 by default', () => {
            const res = ResponseBuilder.error('Oops');
            expect(res.status).toBe(500);
        });

        it('error() accepts custom code', () => {
            expect(ResponseBuilder.error('Bad', 502).status).toBe(502);
        });
    });
});
