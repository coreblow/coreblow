/**
 * CoreBlow — Request Pipeline
 *
 * Processes incoming requests through ordered stages:
 * parsing, validation, auth, rate limiting, and handler
 * execution.
 */

/** Pipeline context */
export interface PipelineContext {
    method: string;
    path: string;
    headers: Record<string, string>;
    body?: unknown;
    params: Record<string, string>;
    state: Record<string, unknown>;
    response?: { status: number; body: unknown; headers: Record<string, string> };
}

/** Pipeline stage */
export interface PipelineStage {
    name: string;
    handler: (ctx: PipelineContext) => Promise<PipelineContext | null>;
}

/**
 * CoreBlow Request Pipeline
 */
export class RequestPipeline {
    private stages: PipelineStage[] = [];
    private stats = { processed: 0, aborted: 0 };

    /**
     * Add a stage.
     */
    use(name: string, handler: PipelineStage['handler']): void {
        this.stages.push({ name, handler });
    }

    /**
     * Process a request through the pipeline.
     */
    async process(ctx: PipelineContext): Promise<PipelineContext> {
        this.stats.processed++;
        let current = ctx;

        for (const stage of this.stages) {
            const result = await stage.handler(current);
            if (result === null) {
                this.stats.aborted++;
                return current;
            }
            current = result;
        }

        return current;
    }

    /**
     * Get stats.
     */
    getStats(): typeof this.stats { return { ...this.stats }; }

    /**
     * List stages.
     */
    list(): string[] { return this.stages.map((s) => s.name); }

    /** Count */
    count(): number { return this.stages.length; }
}
