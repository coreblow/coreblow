/**
 * gateway/server-impl.ts
 * HTTP Server factory — raw node:http, same as CoreBlow
 * Creates HTTP/HTTPS server with manual middleware chain.
 */

import {
    createServer as createHttpServer,
    type Server as HttpServer,
    type IncomingMessage,
    type ServerResponse,
} from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import type { TlsOptions } from 'node:tls';
import { createChildLogger } from '../utils/logger.js';
import {
    handleCors,
    getPathname,
    sendError,
    sendJson,
    requestId,
} from './http-common.js';
import { bootstrapCoreSubsystems } from './server-startup.js';
import type { GatewayRequestContext } from './server-methods/types.js';

const log = createChildLogger('gateway-server');

// ─── Types ───────────────────────────────────────────────────────

export type RouteHandler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;

export interface GatewayServerConfig {
    port: number;
    host: string;
    corsOrigin?: string;
    tls?: TlsOptions;
    maxBodyBytes?: number;
    trustProxy?: boolean;
}

interface RouteEntry {
    method: string;
    path: string;
    handler: RouteHandler;
}

// ─── Gateway Server ──────────────────────────────────────────────

export class GatewayServer {
    private server: HttpServer | null = null;
    private routes: RouteEntry[] = [];
    private config: GatewayServerConfig;
    private startedAt: number = 0;
    private context!: GatewayRequestContext;

    constructor(config: GatewayServerConfig) {
        this.config = config;
    }

    /** Register a route handler. */
    route(method: string, path: string, handler: RouteHandler): this {
        this.routes.push({ method: method.toUpperCase(), path, handler });
        return this;
    }

    /** Shorthand route registrations. */
    get(path: string, handler: RouteHandler): this { return this.route('GET', path, handler); }
    post(path: string, handler: RouteHandler): this { return this.route('POST', path, handler); }
    put(path: string, handler: RouteHandler): this { return this.route('PUT', path, handler); }
    del(path: string, handler: RouteHandler): this { return this.route('DELETE', path, handler); }

    /** Create and start the HTTP server. */
    async start(): Promise<void> {
        // Boot all core subsystems
        this.context = await bootstrapCoreSubsystems(this.config) as unknown as GatewayRequestContext;

        const handler = this.createRequestHandler();

        this.server = this.config.tls
            ? createHttpsServer(this.config.tls, handler)
            : createHttpServer(handler);

        return new Promise((resolve, reject) => {
            this.server!.on('error', (err) => {
                log.error({ err }, 'Server error');
                reject(err);
            });

            this.server!.listen(this.config.port, this.config.host, () => {
                this.startedAt = Date.now();
                log.info(
                    { port: this.config.port, host: this.config.host },
                    `Gateway server listening on ${this.config.host}:${this.config.port}`,
                );
                resolve();
            });
        });
    }

    /** Graceful shutdown. */
    async stop(): Promise<void> {
        if (!this.server) return;

        return new Promise((resolve) => {
            this.server!.close(() => {
                log.info('Gateway server stopped');
                this.server = null;
                resolve();
            });

            // Force-close after 10s
            setTimeout(() => {
                log.warn('Forcing server close after timeout');
                this.server?.closeAllConnections?.();
                resolve();
            }, 10_000);
        });
    }

    /** Get the underlying HTTP server (for WebSocket upgrade). */
    getHttpServer(): HttpServer | null {
        return this.server;
    }

    /** Get server uptime in ms. */
    uptime(): number {
        return this.startedAt ? Date.now() - this.startedAt : 0;
    }

    // ─── Request Handler ─────────────────────────────────────────

    private createRequestHandler(): (req: IncomingMessage, res: ServerResponse) => void {
        return (req, res) => {
            const reqId = requestId();
            res.setHeader('X-Request-Id', reqId);

            // CORS
            if (handleCors(req, res, this.config.corsOrigin)) return;

            const pathname = getPathname(req);
            const method = (req.method ?? 'GET').toUpperCase();

            // RPC Dispatcher
            if (method === 'POST' && pathname === '/rpc') {
                this.handleRpcRequest(req, res, reqId).catch((err) => {
                    log.error({ err, path: pathname, reqId }, 'Unhandled RPC error');
                    if (!res.headersSent) {
                        sendError(res, 500, 'Internal server error', 'internal_error');
                    }
                });
                return;
            }

            // Route matching
            const matched = this.routes.find(
                (r) => r.method === method && this.matchPath(r.path, pathname),
            );

            if (!matched) {
                sendError(res, 404, `Route not found: ${method} ${pathname}`, 'not_found');
                return;
            }

            // Execute handler with error boundary
            Promise.resolve(matched.handler(req, res)).catch((err) => {
                log.error({ err, path: pathname, reqId }, 'Unhandled route error');
                if (!res.headersSent) {
                    sendError(res, 500, 'Internal server error', 'internal_error');
                }
            });
        };
    }

    private async handleRpcRequest(req: IncomingMessage, res: ServerResponse, reqId: string): Promise<void> {
        let body = '';
        for await (const chunk of req) {
            body += chunk;
        }

        let parsed: { method: string; params?: Record<string, unknown> };
        try {
            parsed = JSON.parse(body);
        } catch {
            sendError(res, 400, 'Invalid JSON body', 'invalid_request');
            return;
        }

        if (!parsed.method || typeof parsed.method !== 'string') {
            sendError(res, 400, 'Missing or invalid method', 'invalid_request');
            return;
        }

        // Import dynamically or get from config (we'll implement this later)
        const { coreGatewayHandlers } = await import('./server-methods.js');
        const handler = coreGatewayHandlers[parsed.method];

        if (!handler) {
            sendError(res, 404, `Method not found: ${parsed.method}`, 'not_found');
            return;
        }

        await handler({
            req: { id: reqId, method: parsed.method, params: parsed.params, type: 'rpc' } as any,
            params: parsed.params || {},
            client: null,
            isWebchatConnect: () => false,
            respond: (ok, payload, error) => {
                if (ok) {
                    sendJson(res, 200, { ok: true, data: payload || {} });
                } else {
                    sendJson(res, 400, { ok: false, error: error || { code: 'unknown', message: 'Unknown error' } });
                }
            },
            context: this.context,
        });
    }

    /** Simple path matching — supports exact match and prefix match with trailing wildcard. */
    private matchPath(pattern: string, pathname: string): boolean {
        if (pattern === pathname) return true;
        if (pattern.endsWith('/*')) {
            const prefix = pattern.slice(0, -2);
            return pathname === prefix || pathname.startsWith(prefix + '/');
        }
        return false;
    }
}

// ─── Factory ─────────────────────────────────────────────────────

/** Create a new GatewayServer instance. */
export function createGatewayServer(config: Partial<GatewayServerConfig> = {}): GatewayServer {
    return new GatewayServer({
        port: config.port ?? 3577,
        host: config.host ?? '0.0.0.0',
        corsOrigin: config.corsOrigin ?? '*',
        tls: config.tls,
        maxBodyBytes: config.maxBodyBytes ?? 10 * 1024 * 1024,
        trustProxy: config.trustProxy ?? false,
    });
}
