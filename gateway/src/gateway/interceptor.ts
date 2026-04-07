/**
 * CoreBlow — Request Interceptor
 *
 * Intercepts and transforms HTTP requests/responses before
 * they reach handlers. Supports request logging, response
 * transformation, header injection, and request ID tracking.
 */

import * as crypto from 'node:crypto';

/** Interceptor hook */
export type RequestHook = (req: InterceptedRequest) => InterceptedRequest | null;
export type ResponseHook = (req: InterceptedRequest, res: InterceptedResponse) => InterceptedResponse;

/** Intercepted request */
export interface InterceptedRequest {
    id: string;
    method: string;
    path: string;
    headers: Record<string, string>;
    body?: unknown;
    timestamp: number;
    ip?: string;
    userAgent?: string;
}

/** Intercepted response */
export interface InterceptedResponse {
    status: number;
    headers: Record<string, string>;
    body?: unknown;
    durationMs: number;
}

/** Request log entry */
export interface RequestLogEntry {
    id: string;
    method: string;
    path: string;
    status: number;
    durationMs: number;
    timestamp: number;
    ip?: string;
}

/**
 * CoreBlow Request Interceptor
 */
export class RequestInterceptor {
    private requestHooks: Array<{ name: string; hook: RequestHook }> = [];
    private responseHooks: Array<{ name: string; hook: ResponseHook }> = [];
    private log: RequestLogEntry[] = [];
    private maxLog = 1000;

    /**
     * Add a request interceptor.
     */
    onRequest(name: string, hook: RequestHook): void {
        this.requestHooks.push({ name, hook });
    }

    /**
     * Add a response interceptor.
     */
    onResponse(name: string, hook: ResponseHook): void {
        this.responseHooks.push({ name, hook });
    }

    /**
     * Create an intercepted request.
     */
    createRequest(method: string, path: string, headers?: Record<string, string>, body?: unknown): InterceptedRequest {
        return {
            id: crypto.randomBytes(8).toString('hex'),
            method: method.toUpperCase(),
            path,
            headers: headers ?? {},
            body,
            timestamp: Date.now(),
            ip: headers?.['x-forwarded-for'],
            userAgent: headers?.['user-agent'],
        };
    }

    /**
     * Process request through hooks.
     * Returns null if request should be blocked.
     */
    processRequest(req: InterceptedRequest): InterceptedRequest | null {
        let current: InterceptedRequest | null = req;
        for (const { hook } of this.requestHooks) {
            if (!current) return null;
            current = hook(current);
        }
        return current;
    }

    /**
     * Process response through hooks.
     */
    processResponse(req: InterceptedRequest, res: InterceptedResponse): InterceptedResponse {
        let current = res;
        for (const { hook } of this.responseHooks) {
            current = hook(req, current);
        }

        // Log
        this.log.push({
            id: req.id,
            method: req.method,
            path: req.path,
            status: current.status,
            durationMs: current.durationMs,
            timestamp: req.timestamp,
            ip: req.ip,
        });
        if (this.log.length > this.maxLog) this.log = this.log.slice(-this.maxLog);

        return current;
    }

    /**
     * Get request log.
     */
    getLog(limit?: number): RequestLogEntry[] {
        return this.log.slice(-(limit ?? 50));
    }

    /**
     * Get log stats.
     */
    getStats(): { totalRequests: number; avgDurationMs: number; statusCodes: Record<number, number> } {
        const statusCodes: Record<number, number> = {};
        let totalDuration = 0;
        for (const entry of this.log) {
            statusCodes[entry.status] = (statusCodes[entry.status] ?? 0) + 1;
            totalDuration += entry.durationMs;
        }
        return {
            totalRequests: this.log.length,
            avgDurationMs: this.log.length > 0 ? totalDuration / this.log.length : 0,
            statusCodes,
        };
    }

    /**
     * List registered hooks.
     */
    listHooks(): { request: string[]; response: string[] } {
        return {
            request: this.requestHooks.map((h) => h.name),
            response: this.responseHooks.map((h) => h.name),
        };
    }
}
