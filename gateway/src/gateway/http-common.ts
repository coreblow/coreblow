/**
 * CoreBlow HTTP Common Utilities
 *
 * Shared HTTP utilities: status codes, content negotiation, CORS,
 * request parsing, and response helpers.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('gateway:http');

// ─── Status Codes ─────────────────────────────────────────────────

export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    INTERNAL: 500,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504,
} as const;

// ─── CORS ─────────────────────────────────────────────────────────

export interface CorsOptions {
    origins: string[];
    methods?: string[];
    headers?: string[];
    maxAge?: number;
    credentials?: boolean;
}

export function buildCorsHeaders(origin: string, options: CorsOptions): Record<string, string> {
    const headers: Record<string, string> = {};
    const allowed = options.origins.includes('*') || options.origins.includes(origin);
    if (!allowed) return headers;

    headers['Access-Control-Allow-Origin'] = options.origins.includes('*') ? '*' : origin;
    headers['Access-Control-Allow-Methods'] = (options.methods ?? ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']).join(', ');
    headers['Access-Control-Allow-Headers'] = (options.headers ?? ['Content-Type', 'Authorization', 'X-API-Key']).join(', ');
    if (options.maxAge) headers['Access-Control-Max-Age'] = String(options.maxAge);
    if (options.credentials) headers['Access-Control-Allow-Credentials'] = 'true';
    return headers;
}

// ─── Content Negotiation ──────────────────────────────────────────

export type ContentType = 'json' | 'text' | 'sse' | 'html' | 'unknown';

export function negotiateContentType(acceptHeader?: string): ContentType {
    if (!acceptHeader) return 'json';
    const lower = acceptHeader.toLowerCase();
    if (lower.includes('text/event-stream')) return 'sse';
    if (lower.includes('application/json')) return 'json';
    if (lower.includes('text/html')) return 'html';
    if (lower.includes('text/plain')) return 'text';
    return 'json';
}

export function contentTypeHeader(type: ContentType): string {
    switch (type) {
        case 'json': return 'application/json; charset=utf-8';
        case 'text': return 'text/plain; charset=utf-8';
        case 'sse': return 'text/event-stream';
        case 'html': return 'text/html; charset=utf-8';
        default: return 'application/octet-stream';
    }
}

// ─── Request Helpers ──────────────────────────────────────────────

export function parseQueryString(url: string): Record<string, string> {
    const idx = url.indexOf('?');
    if (idx < 0) return {};
    const params: Record<string, string> = {};
    const search = url.slice(idx + 1);
    for (const pair of search.split('&')) {
        const [key, ...valueParts] = pair.split('=');
        if (key) params[decodeURIComponent(key)] = decodeURIComponent(valueParts.join('='));
    }
    return params;
}

export function extractBearerToken(authHeader?: string): string | null {
    if (!authHeader?.startsWith('Bearer ')) return null;
    return authHeader.slice(7).trim();
}

export function getClientIp(headers: Record<string, string | undefined>, remoteAddress?: string): string {
    return headers['x-forwarded-for']?.split(',')[0]?.trim()
        ?? headers['x-real-ip']
        ?? remoteAddress
        ?? '0.0.0.0';
}

// ─── Response Helpers ─────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
    ok: boolean;
    data?: T;
    error?: { code: string; message: string; details?: unknown };
    meta?: { requestId?: string; timestamp?: number; duration?: number };
}

export function successResponse<T>(data: T, meta?: ApiResponse['meta']): ApiResponse<T> {
    return { ok: true, data, meta: { ...meta, timestamp: Date.now() } };
}

export function errorResponse(code: string, message: string, details?: unknown): ApiResponse {
    return { ok: false, error: { code, message, details }, meta: { timestamp: Date.now() } };
}

// ─── SSE Helpers ──────────────────────────────────────────────────

export function formatSSEEvent(data: unknown, event?: string, id?: string): string {
    let output = '';
    if (id) output += `id: ${id}\n`;
    if (event) output += `event: ${event}\n`;
    output += `data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`;
    return output;
}

export function formatSSEComment(comment: string): string {
    return `: ${comment}\n\n`;
}

export function handleCors(req: IncomingMessage, res: ServerResponse, origin?: string): boolean { return false; }
export function getPathname(req: IncomingMessage): string { return req.url?.split('?')[0] || '/'; }
export function sendError(res: ServerResponse, status: number, message: string, code: string) { res.statusCode = status; res.end(JSON.stringify({ error: { message, code } })); }
export function sendJson(res: ServerResponse, status: number, body: unknown) { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); }
export function requestId(): string { return Math.random().toString(36).substring(7); }
