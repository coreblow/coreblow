/**
 * CoreBlow — Middleware Composer
 *
 * Koa/Express-style middleware composition for the gateway.
 * Supports async middleware, error handling, named middleware,
 * conditional execution, and timing metrics.
 */

/** Request-like context */
export interface MiddlewareContext {
    path: string;
    method: string;
    headers: Record<string, string>;
    body?: unknown;
    params: Record<string, string>;
    query: Record<string, string>;
    state: Record<string, unknown>;
    response: {
        status: number;
        headers: Record<string, string>;
        body?: unknown;
    };
}

/** Next function */
export type NextFn = () => Promise<void>;

/** Middleware function */
export type MiddlewareFn = (ctx: MiddlewareContext, next: NextFn) => Promise<void>;

/** Named middleware entry */
interface MiddlewareEntry {
    name: string;
    fn: MiddlewareFn;
    condition?: (ctx: MiddlewareContext) => boolean;
    order: number;
}

/**
 * CoreBlow Middleware Composer
 */
export class MiddlewareComposer {
    private middleware: MiddlewareEntry[] = [];
    private errorHandler: ((err: Error, ctx: MiddlewareContext) => void) | null = null;
    private metrics: Array<{ name: string; durationMs: number; timestamp: number }> = [];
    private maxMetrics = 500;

    /**
     * Add middleware.
     */
    use(name: string, fn: MiddlewareFn, options?: { condition?: (ctx: MiddlewareContext) => boolean; order?: number }): this {
        this.middleware.push({
            name,
            fn,
            condition: options?.condition,
            order: options?.order ?? this.middleware.length,
        });
        this.middleware.sort((a, b) => a.order - b.order);
        return this;
    }

    /**
     * Set error handler.
     */
    onError(handler: (err: Error, ctx: MiddlewareContext) => void): this {
        this.errorHandler = handler;
        return this;
    }

    /**
     * Compose and execute all middleware.
     */
    async execute(ctx: MiddlewareContext): Promise<void> {
        const entries = this.middleware.filter((m) => !m.condition || m.condition(ctx));
        let index = 0;

        const next = async (): Promise<void> => {
            if (index >= entries.length) return;
            const entry = entries[index++]!;
            const start = Date.now();

            try {
                await entry.fn(ctx, next);
                this.recordMetric(entry.name, Date.now() - start);
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                if (this.errorHandler) {
                    this.errorHandler(error, ctx);
                } else {
                    throw error;
                }
            }
        };

        await next();
    }

    /**
     * Create a new context.
     */
    static createContext(method: string, path: string, headers?: Record<string, string>, body?: unknown): MiddlewareContext {
        return {
            path,
            method: method.toUpperCase(),
            headers: headers ?? {},
            body,
            params: {},
            query: {},
            state: {},
            response: { status: 200, headers: {}, body: undefined },
        };
    }

    /**
     * Get middleware names.
     */
    list(): string[] {
        return this.middleware.map((m) => m.name);
    }

    /**
     * Get metrics.
     */
    getMetrics(limit?: number): typeof this.metrics {
        return this.metrics.slice(-(limit ?? 50));
    }

    /**
     * Remove middleware by name.
     */
    remove(name: string): boolean {
        const idx = this.middleware.findIndex((m) => m.name === name);
        if (idx === -1) return false;
        this.middleware.splice(idx, 1);
        return true;
    }

    // === Private ===

    private recordMetric(name: string, durationMs: number): void {
        this.metrics.push({ name, durationMs, timestamp: Date.now() });
        if (this.metrics.length > this.maxMetrics) this.metrics = this.metrics.slice(-this.maxMetrics);
    }
}
