/**
 * CoreBlow — Data Pipeline
 *
 * Composable data transformation pipeline with typed stages,
 * error handling, branching, and metrics. Used for processing
 * inbound messages, outbound formatting, and ETL tasks.
 */

/** Pipeline stage */
export interface PipelineStage<I = unknown, O = unknown> {
    name: string;
    transform: (input: I) => O | Promise<O>;
    condition?: (input: I) => boolean;
}

/** Pipeline execution result */
export interface PipelineResult<T> {
    success: boolean;
    output?: T;
    error?: string;
    stages: Array<{ name: string; durationMs: number; skipped: boolean }>;
    totalDurationMs: number;
}

/**
 * CoreBlow Data Pipeline
 */
export class DataPipeline<I = unknown, O = unknown> {
    private stages: Array<PipelineStage<any, any>> = [];
    private errorHandler: ((err: Error, stage: string) => void) | null = null;
    private history: PipelineResult<unknown>[] = [];
    private maxHistory = 100;

    /**
     * Add a transformation stage.
     */
    pipe<Next>(stage: PipelineStage<O, Next>): DataPipeline<I, Next> {
        this.stages.push(stage);
        return this as unknown as DataPipeline<I, Next>;
    }

    /**
     * Add a simple transform function.
     */
    map<Next>(name: string, fn: (input: O) => Next | Promise<Next>): DataPipeline<I, Next> {
        return this.pipe({ name, transform: fn });
    }

    /**
     * Add a filter stage (pass-through or skip).
     */
    filter(name: string, predicate: (input: O) => boolean): DataPipeline<I, O> {
        return this.pipe({
            name,
            transform: (input: unknown) => input,
            condition: predicate as (input: unknown) => boolean,
        }) as unknown as DataPipeline<I, O>;
    }

    /**
     * Set error handler.
     */
    onError(handler: (err: Error, stage: string) => void): this {
        this.errorHandler = handler;
        return this;
    }

    /**
     * Execute the pipeline.
     */
    async execute(input: I): Promise<PipelineResult<O>> {
        const start = Date.now();
        const stageResults: Array<{ name: string; durationMs: number; skipped: boolean }> = [];
        let current: unknown = input;

        for (const stage of this.stages) {
            const stageStart = Date.now();

            // Check condition
            if (stage.condition && !stage.condition(current)) {
                stageResults.push({ name: stage.name, durationMs: 0, skipped: true });
                continue;
            }

            try {
                current = await stage.transform(current);
                stageResults.push({ name: stage.name, durationMs: Date.now() - stageStart, skipped: false });
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                if (this.errorHandler) this.errorHandler(error, stage.name);

                const result: PipelineResult<O> = {
                    success: false,
                    error: `Stage "${stage.name}" failed: ${error.message}`,
                    stages: stageResults,
                    totalDurationMs: Date.now() - start,
                };
                this.record(result);
                return result;
            }
        }

        const result: PipelineResult<O> = {
            success: true,
            output: current as O,
            stages: stageResults,
            totalDurationMs: Date.now() - start,
        };
        this.record(result);
        return result;
    }

    /**
     * Get execution history.
     */
    getHistory(limit?: number): PipelineResult<unknown>[] {
        return this.history.slice(-(limit ?? 20));
    }

    /**
     * Get pipeline stage names.
     */
    getStageNames(): string[] {
        return this.stages.map((s) => s.name);
    }

    // === Static Helpers ===

    /**
     * Create a new pipeline.
     */
    static create<T>(): DataPipeline<T, T> {
        return new DataPipeline<T, T>();
    }

    // === Private ===

    private record(result: PipelineResult<unknown>): void {
        this.history.push(result);
        if (this.history.length > this.maxHistory) this.history = this.history.slice(-this.maxHistory);
    }
}
