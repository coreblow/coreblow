import { describe, it, expect, beforeEach } from 'vitest';
import * as crypto from 'node:crypto';
import * as http from 'node:http';
import { InboundReceiver, type WebhookConfig } from './inbound.js';

// ─── Helpers ────────────────────────────────────────────────────

/** Create a fake IncomingMessage from a body and options */
function mockRequest(
    body: string,
    options: {
        url?: string;
        method?: string;
        headers?: Record<string, string>;
    } = {},
): http.IncomingMessage {
    const { Readable } = require('stream');
    const stream = new Readable({
        read() {
            this.push(Buffer.from(body));
            this.push(null);
        },
    });
    stream.url = options.url ?? '/webhook/test';
    stream.method = options.method ?? 'POST';
    stream.headers = {
        host: 'localhost:3000',
        'content-type': 'application/json',
        ...options.headers,
    };
    return stream as http.IncomingMessage;
}

/** Create a fake ServerResponse that captures output */
function mockResponse(): http.ServerResponse & { _status: number; _body: string } {
    const res = {
        _status: 0,
        _body: '',
        _headers: {} as Record<string, string>,
        writeHead(status: number, headers?: Record<string, string>) {
            res._status = status;
            if (headers) Object.assign(res._headers, headers);
        },
        end(body?: string) {
            res._body = body ?? '';
        },
    };
    return res as unknown as http.ServerResponse & { _status: number; _body: string };
}

// ─── Tests ──────────────────────────────────────────────────────

describe('InboundReceiver', () => {
    let receiver: InboundReceiver;

    beforeEach(() => {
        receiver = new InboundReceiver();
    });

    describe('register + listWebhooks', () => {
        it('registers a webhook', () => {
            const config: WebhookConfig = { channelId: 'telegram', path: '/webhook/telegram' };
            receiver.register(config);
            expect(receiver.listWebhooks()).toHaveLength(1);
            expect(receiver.listWebhooks()[0].channelId).toBe('telegram');
        });

        it('registers multiple webhooks', () => {
            receiver.register({ channelId: 'telegram', path: '/webhook/telegram' });
            receiver.register({ channelId: 'slack', path: '/webhook/slack' });
            expect(receiver.listWebhooks()).toHaveLength(2);
        });

        it('overwrites duplicate paths', () => {
            receiver.register({ channelId: 'old', path: '/webhook/test' });
            receiver.register({ channelId: 'new', path: '/webhook/test' });
            expect(receiver.listWebhooks()).toHaveLength(1);
            expect(receiver.listWebhooks()[0].channelId).toBe('new');
        });
    });

    describe('handle — basic routing', () => {
        it('returns false for unregistered path', async () => {
            const req = mockRequest('{}', { url: '/not-registered' });
            const res = mockResponse();
            expect(await receiver.handle(req, res)).toBe(false);
        });

        it('returns false for GET method', async () => {
            receiver.register({ channelId: 'test', path: '/webhook/test' });
            const req = mockRequest('{}', { method: 'GET' });
            const res = mockResponse();
            expect(await receiver.handle(req, res)).toBe(false);
        });

        it('handles POST to registered path', async () => {
            receiver.register({ channelId: 'test', path: '/webhook/test' });
            const req = mockRequest('{"msg":"hello"}');
            const res = mockResponse();
            const handled = await receiver.handle(req, res);
            expect(handled).toBe(true);
            expect(res._status).toBe(200);
            expect(JSON.parse(res._body)).toEqual({ ok: true });
        });
    });

    describe('handle — handler callback', () => {
        it('calls onWebhook handler with payload and channelId', async () => {
            receiver.register({ channelId: 'telegram', path: '/webhook/telegram' });
            let receivedPayload: Record<string, unknown> | null = null;
            let receivedChannel = '';
            receiver.onWebhook((payload, channelId) => {
                receivedPayload = payload;
                receivedChannel = channelId;
            });

            const req = mockRequest('{"type":"message","text":"hello"}', { url: '/webhook/telegram' });
            const res = mockResponse();
            await receiver.handle(req, res);

            expect(receivedPayload).toEqual({ type: 'message', text: 'hello' });
            expect(receivedChannel).toBe('telegram');
        });

        it('responds 200 even without handler', async () => {
            receiver.register({ channelId: 'test', path: '/webhook/test' });
            const req = mockRequest('{"ok":true}');
            const res = mockResponse();
            await receiver.handle(req, res);
            expect(res._status).toBe(200);
        });
    });

    describe('handle — signature verification', () => {
        const secret = 'test-secret-key';
        const config: WebhookConfig = {
            channelId: 'secure',
            path: '/webhook/secure',
            secret,
            signatureHeader: 'X-Signature',
            signatureAlgo: 'sha256',
        };

        it('accepts valid signature', async () => {
            receiver.register(config);
            const body = '{"event":"test"}';
            const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');

            const req = mockRequest(body, {
                url: '/webhook/secure',
                headers: { 'x-signature': signature },
            });
            const res = mockResponse();
            await receiver.handle(req, res);
            expect(res._status).toBe(200);
        });

        it('accepts prefixed signature (sha256=...)', async () => {
            receiver.register(config);
            const body = '{"event":"test"}';
            const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');

            const req = mockRequest(body, {
                url: '/webhook/secure',
                headers: { 'x-signature': `sha256=${sig}` },
            });
            const res = mockResponse();
            await receiver.handle(req, res);
            expect(res._status).toBe(200);
        });

        it('rejects invalid signature', async () => {
            receiver.register(config);
            const req = mockRequest('{"event":"test"}', {
                url: '/webhook/secure',
                headers: { 'x-signature': 'deadbeef' },
            });
            const res = mockResponse();
            await receiver.handle(req, res);
            expect(res._status).toBe(403);
            expect(JSON.parse(res._body).error).toContain('Invalid signature');
        });

        it('rejects missing signature', async () => {
            receiver.register(config);
            const req = mockRequest('{"event":"test"}', { url: '/webhook/secure' });
            const res = mockResponse();
            await receiver.handle(req, res);
            expect(res._status).toBe(403);
        });
    });

    describe('handle — error handling', () => {
        it('responds 500 for invalid JSON body', async () => {
            receiver.register({ channelId: 'test', path: '/webhook/test' });
            const req = mockRequest('not-json{{{', { url: '/webhook/test' });
            const res = mockResponse();
            await receiver.handle(req, res);
            expect(res._status).toBe(500);
        });
    });
});
