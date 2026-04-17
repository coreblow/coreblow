/**
 * CoreBlow — Middleware Chain
 *
 * Composable middleware chain with next() support,
 * error handling, and timing.
 */

/** Middleware context */
export interface MiddlewareContext {
    request: { method: string; path: string; headers: Record<string, string>; body?: unknown };
    response: { status: number; body: unknown; headers: Record<string, string> };
    state: Record<string, unknown>;
}

/** Middleware function */
export type MiddlewareFn = (ctx: MiddlewareContext, next: () => Promise<void>) => Promise<void>;

/** Middleware entry */
export interface MiddlewareEntry {
    name: string;
    fn: MiddlewareFn;
    path?: string;
}

/**
 * CoreBlow Middleware Chain
 */
export class MiddlewareChain {
    private middlewares: MiddlewareEntry[] = [];
    private stats = { executed: 0, errors: 0 };

    /**
     * Add middleware.
     */
    use(name: string, fn: MiddlewareFn, path?: string): void {
        this.middlewares.push({ name, fn, path });
    }

    /**
     * Execute the chain.
     */
    async execute(ctx: MiddlewareContext): Promise<MiddlewareContext> {
        this.stats.executed++;
        const applicable = this.middlewares.filter((m) => !m.path || ctx.request.path.startsWith(m.path));
        let index = 0;

        const next = async (): Promise<void> => {
            if (index >= applicable.length) return;
            const mw = applicable[index++]!;
            try {
                await mw.fn(ctx, next);
            } catch (err) {
                this.stats.errors++;
                ctx.response.status = 500;
                ctx.response.body = { error: err instanceof Error ? err.message : 'Middleware error' };
            }
        };

        await next();
        return ctx;
    }

    /**
     * Create a default context.
     */
    createContext(method: string, path: string, headers?: Record<string, string>): MiddlewareContext {
        return {
            request: { method, path, headers: headers ?? {} },
            response: { status: 200, body: null, headers: {} },
            state: {},
        };
    }

    /**
     * Get stats.
     */
    getStats(): typeof this.stats { return { ...this.stats }; }

    /**
     * List middlewares.
     */
    list(): Array<{ name: string; path?: string }> {
        return this.middlewares.map((m) => ({ name: m.name, path: m.path }));
    }

    /** Count */
    count(): number { return this.middlewares.length; }
}
