/**
 * CoreBlow — API Gateway
 *
 * Unified API gateway combining route matching,
 * middleware chain, request pipeline, and response
 * building into a single request handler.
 */

import { RouteMatcher } from './route-matcher.js';
import { MiddlewareChain, type MiddlewareContext, type MiddlewareFn } from './middleware-chain.js';
import { ResponseBuilder } from './response-builder.js';

/** Route handler */
export type RouteHandler = (ctx: MiddlewareContext) => Promise<void>;

/**
 * CoreBlow API Gateway
 */
export class ApiGateway {
    private router: RouteMatcher;
    private middleware: MiddlewareChain;
    private handlers = new Map<string, RouteHandler>();
    private stats = { requests: 0, success: 0, errors: 0 };

    constructor() {
        this.router = new RouteMatcher();
        this.middleware = new MiddlewareChain();
    }

    /**
     * Register a route with handler.
     */
    route(method: string, path: string, handler: RouteHandler, mw?: string[]): void {
        const handlerId = `${method}:${path}`;
        this.router.add(method, path, handlerId, mw);
        this.handlers.set(handlerId, handler);
    }

    /**
     * Convenience methods.
     */
    get(path: string, handler: RouteHandler): void { this.route('GET', path, handler); }
    post(path: string, handler: RouteHandler): void { this.route('POST', path, handler); }

    /**
     * Add global middleware.
     */
    use(name: string, fn: MiddlewareFn, path?: string): void {
        this.middleware.use(name, fn, path);
    }

    /**
     * Handle a request.
     */
    async handle(method: string, path: string, headers?: Record<string, string>, body?: unknown): Promise<{ status: number; body: unknown; headers: Record<string, string> }> {
        this.stats.requests++;
        const match = this.router.match(method, path);

        if (!match) {
            this.stats.errors++;
            return ResponseBuilder.notFound(`Route ${method} ${path} not found`);
        }

        const ctx = this.middleware.createContext(method, path, headers);
        ctx.request.body = body;
        ctx.state.params = match.params;
        ctx.state.query = match.query;

        // Run middleware
        const handler = this.handlers.get(match.route.handler);

        this.middleware.use('__handler__', async (c) => {
            if (handler) await handler(c);
        });

        try {
            await this.middleware.execute(ctx);
            this.stats.success++;
        } catch {
            this.stats.errors++;
            ctx.response = { status: 500, body: { error: 'Internal error' }, headers: {} };
        }

        // Remove temp handler
        const list = (this.middleware as unknown as { middlewares: Array<{ name: string }> }).middlewares;
        const idx = list.findIndex((m) => m.name === '__handler__');
        if (idx !== -1) list.splice(idx, 1);

        return ctx.response;
    }

    /**
     * Get stats.
     */
    getStats(): typeof this.stats { return { ...this.stats }; }

    /**
     * Get router.
     */
    getRouter(): RouteMatcher { return this.router; }

    /** Count routes */
    count(): number { return this.router.count(); }
}
