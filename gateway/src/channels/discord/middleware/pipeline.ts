/**
 * Discord Middleware Pipeline — Sequential middleware chain for message processing.
 */
export type MiddlewareContext = { message: Record<string, unknown>; guild?: string; channel?: string; user?: string; handled: boolean; metadata: Record<string, unknown> };
export type MiddlewareFn = (ctx: MiddlewareContext, next: () => Promise<void>) => Promise<void>;

export class DiscordMiddlewarePipeline {
    private middlewares: MiddlewareFn[] = [];

    use(fn: MiddlewareFn): void { this.middlewares.push(fn); }

    async execute(ctx: MiddlewareContext): Promise<MiddlewareContext> {
        let index = 0;
        const next = async (): Promise<void> => {
            if (index < this.middlewares.length) {
                const fn = this.middlewares[index++]!;
                await fn(ctx, next);
            }
        };
        await next();
        return ctx;
    }

    get count(): number { return this.middlewares.length; }
}