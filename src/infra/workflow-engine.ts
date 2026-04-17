/**
 * CoreBlow — Workflow Engine
 *
 * Orchestrates multi-step workflows with conditional
 * branching, parallel steps, error handling, and
 * execution history.
 */

/** Workflow step */
export interface WorkflowStep {
    id: string;
    name: string;
    handler: (ctx: WorkflowContext) => Promise<unknown>;
    condition?: (ctx: WorkflowContext) => boolean;
    onError?: 'stop' | 'skip' | 'retry';
    maxRetries?: number;
}

/** Workflow context */
export interface WorkflowContext {
    data: Record<string, unknown>;
    stepResults: Record<string, unknown>;
    errors: Array<{ stepId: string; error: string }>;
}

/** Workflow definition */
export interface WorkflowDef {
    id: string;
    name: string;
    steps: WorkflowStep[];
}

/** Workflow result */
export interface WorkflowResult {
    workflowId: string;
    status: 'completed' | 'failed' | 'partial';
    stepsExecuted: number;
    stepsSkipped: number;
    context: WorkflowContext;
    durationMs: number;
}

/**
 * CoreBlow Workflow Engine
 */
export class WorkflowEngine {
    private workflows = new Map<string, WorkflowDef>();
    private history: WorkflowResult[] = [];
    private maxHistory = 100;

    /**
     * Register a workflow.
     */
    register(workflow: WorkflowDef): void {
        this.workflows.set(workflow.id, workflow);
    }

    /**
     * Execute a workflow.
     */
    async execute(workflowId: string, initialData?: Record<string, unknown>): Promise<WorkflowResult> {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            return { workflowId, status: 'failed', stepsExecuted: 0, stepsSkipped: 0, context: { data: {}, stepResults: {}, errors: [{ stepId: '', error: 'Workflow not found' }] }, durationMs: 0 };
        }

        const start = Date.now();
        const ctx: WorkflowContext = { data: initialData ?? {}, stepResults: {}, errors: [] };
        let executed = 0, skipped = 0;

        for (const step of workflow.steps) {
            // Check condition
            if (step.condition && !step.condition(ctx)) { skipped++; continue; }

            let retries = 0;
            const maxRetries = step.maxRetries ?? 0;

            while (retries <= maxRetries) {
                try {
                    const result = await step.handler(ctx);
                    ctx.stepResults[step.id] = result;
                    executed++;
                    break;
                } catch (err) {
                    const errorMsg = err instanceof Error ? err.message : String(err);
                    if (retries >= maxRetries) {
                        ctx.errors.push({ stepId: step.id, error: errorMsg });
                        if (step.onError === 'stop' || !step.onError) {
                            return { workflowId, status: 'failed', stepsExecuted: executed, stepsSkipped: skipped, context: ctx, durationMs: Date.now() - start };
                        }
                        if (step.onError === 'skip') { skipped++; break; }
                    }
                    retries++;
                }
            }
        }

        const result: WorkflowResult = { workflowId, status: ctx.errors.length > 0 ? 'partial' : 'completed', stepsExecuted: executed, stepsSkipped: skipped, context: ctx, durationMs: Date.now() - start };
        this.history.push(result);
        if (this.history.length > this.maxHistory) this.history = this.history.slice(-this.maxHistory);
        return result;
    }

    /**
     * Get a workflow.
     */
    get(id: string): WorkflowDef | null { return this.workflows.get(id) ?? null; }

    /**
     * Get execution history.
     */
    getHistory(limit?: number): WorkflowResult[] { return this.history.slice(-(limit ?? 20)); }

    /**
     * List workflows.
     */
    list(): Array<{ id: string; name: string; steps: number }> {
        return Array.from(this.workflows.values()).map((w) => ({ id: w.id, name: w.name, steps: w.steps.length }));
    }

    /** Count */
    count(): number { return this.workflows.size; }
}
