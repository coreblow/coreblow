/**
 * CoreBlow — ETL Pipeline
 *
 * Extract-Transform-Load pipeline with configurable
 * stages, error handling, and progress tracking.
 */

/** ETL stage */
export interface ETLStage {
    name: string;
    handler: (data: unknown[]) => Promise<unknown[]>;
}

/** ETL result */
export interface ETLResult {
    pipelineId: string;
    status: 'completed' | 'failed';
    inputCount: number;
    outputCount: number;
    stages: Array<{ name: string; inputCount: number; outputCount: number; durationMs: number }>;
    totalDurationMs: number;
    error?: string;
}

/**
 * CoreBlow ETL Pipeline
 */
export class ETLPipeline {
    private pipelines = new Map<string, { name: string; stages: ETLStage[] }>();
    private history: ETLResult[] = [];
    private idCounter = 0;

    /**
     * Create a pipeline.
     */
    create(name: string, stages: ETLStage[]): string {
        const id = `etl-${++this.idCounter}`;
        this.pipelines.set(id, { name, stages });
        return id;
    }

    /**
     * Run a pipeline.
     */
    async run(pipelineId: string, input: unknown[]): Promise<ETLResult> {
        const pipeline = this.pipelines.get(pipelineId);
        if (!pipeline) {
            return { pipelineId, status: 'failed', inputCount: input.length, outputCount: 0, stages: [], totalDurationMs: 0, error: 'Pipeline not found' };
        }

        const start = Date.now();
        const stageResults: ETLResult['stages'] = [];
        let data = [...input];

        for (const stage of pipeline.stages) {
            const stageStart = Date.now();
            const inputCount = data.length;
            try {
                data = await stage.handler(data);
                stageResults.push({ name: stage.name, inputCount, outputCount: data.length, durationMs: Date.now() - stageStart });
            } catch (err) {
                const result: ETLResult = {
                    pipelineId, status: 'failed', inputCount: input.length, outputCount: 0,
                    stages: stageResults, totalDurationMs: Date.now() - start,
                    error: err instanceof Error ? err.message : String(err),
                };
                this.history.push(result);
                return result;
            }
        }

        const result: ETLResult = { pipelineId, status: 'completed', inputCount: input.length, outputCount: data.length, stages: stageResults, totalDurationMs: Date.now() - start };
        this.history.push(result);
        return result;
    }

    /**
     * Get history.
     */
    getHistory(limit?: number): ETLResult[] { return this.history.slice(-(limit ?? 20)); }

    /**
     * List pipelines.
     */
    list(): Array<{ id: string; name: string; stages: number }> {
        return Array.from(this.pipelines.entries()).map(([id, p]) => ({ id, name: p.name, stages: p.stages.length }));
    }

    /** Count */
    count(): number { return this.pipelines.size; }
}
