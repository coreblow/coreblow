/**
 * CoreBlow — Workflow Engine
 *
 * Multi-step workflow orchestration for complex agent tasks.
 * Supports sequential, parallel, and conditional step execution
 * with error handling, step results, and execution history.
 */

import { retryAsync } from '../infra/retry.js';

/** Workflow step */
export interface WorkflowStep {
    id: string;
    name: string;
    /** Handler function */
    handler: (context: WorkflowContext) => Promise<unknown>;
    /** Condition — skip step if returns false */
    condition?: (context: WorkflowContext) => boolean;
    /** Error handling strategy */
    onError?: 'fail' | 'skip' | 'retry';
    /** Max retries if onError='retry' */
    retries?: number;
    /** Timeout in ms */
    timeoutMs?: number;
}

/** Workflow definition */
export interface WorkflowDefinition {
    id: string;
    name: string;
    steps: WorkflowStep[];
    /** Parallel step IDs (run concurrently) */
    parallelSteps?: string[][];
}

/** Execution context passed between steps */
export interface WorkflowContext {
    workflowId: string;
    results: Record<string, unknown>;
    metadata: Record<string, unknown>;
    startedAt: number;
}

/** Step execution result */
export interface StepResult {
    stepId: string;
    status: 'success' | 'error' | 'skipped';
    output?: unknown;
    error?: string;
    durationMs: number;
}

/** Workflow execution result */
export interface WorkflowResult {
    workflowId: string;
    status: 'completed' | 'failed' | 'partial';
    steps: StepResult[];
    totalDurationMs: number;
    context: WorkflowContext;
}

/**
 * CoreBlow Workflow Engine
 */
export class WorkflowEngine {
    private workflows = new Map<string, WorkflowDefinition>();
    private history: WorkflowResult[] = [];
    private maxHistory = 100;

    /**
     * Register a workflow.
     */
    register(workflow: WorkflowDefinition): void {
        this.workflows.set(workflow.id, workflow);
    }

    /**
     * Execute a workflow.
     */
    async execute(workflowId: string, initialData?: Record<string, unknown>): Promise<WorkflowResult> {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error(`Workflow "${workflowId}" not found`);
        }

        const context: WorkflowContext = {
            workflowId,
            results: {},
            metadata: initialData ?? {},
            startedAt: Date.now(),
        };

        const stepResults: StepResult[] = [];
        let failed = false;

        for (const step of workflow.steps) {
            // Check if this is a parallel group
            const isParallel = workflow.parallelSteps?.some((group) => group.includes(step.id));
            if (isParallel) {
                const group = workflow.parallelSteps!.find((g) => g.includes(step.id))!;
                // Only execute when we hit the first step in the group
                if (group[0] !== step.id) continue;

                const parallelResults = await this.executeParallel(
                    group.map((id) => workflow.steps.find((s) => s.id === id)!).filter(Boolean),
                    context,
                );
                stepResults.push(...parallelResults);
                if (parallelResults.some((r) => r.status === 'error')) failed = true;
                continue;
            }

            const result = await this.executeStep(step, context);
            stepResults.push(result);

            if (result.status === 'error') {
                failed = true;
                if (step.onError === 'fail' || !step.onError) break;
            }

            if (result.status === 'success') {
                context.results[step.id] = result.output;
            }
        }

        const workflowResult: WorkflowResult = {
            workflowId,
            status: failed ? (stepResults.some((r) => r.status === 'success') ? 'partial' : 'failed') : 'completed',
            steps: stepResults,
            totalDurationMs: Date.now() - context.startedAt,
            context,
        };

        this.history.push(workflowResult);
        if (this.history.length > this.maxHistory) this.history = this.history.slice(-this.maxHistory);

        return workflowResult;
    }

    /**
     * List registered workflows.
     */
    list(): Array<{ id: string; name: string; stepCount: number }> {
        return Array.from(this.workflows.values()).map((w) => ({
            id: w.id,
            name: w.name,
            stepCount: w.steps.length,
        }));
    }

    /**
     * Get execution history.
     */
    getHistory(limit?: number): WorkflowResult[] {
        return this.history.slice(-(limit ?? 20));
    }

    // === Private ===

    private async executeStep(step: WorkflowStep, context: WorkflowContext): Promise<StepResult> {
        // Check condition
        if (step.condition && !step.condition(context)) {
            return { stepId: step.id, status: 'skipped', durationMs: 0 };
        }

        const maxAttempts = (step.onError === 'retry' ? (step.retries ?? 2) : 0) + 1;
        const start = Date.now();
        try {
            const output = await retryAsync(
                () => this.withTimeout(step.handler(context), step.timeoutMs ?? 60_000, step.name),
                maxAttempts,
                100,
            );
            return { stepId: step.id, status: 'success', output, durationMs: Date.now() - start };
        } catch (err) {
            const lastError = err instanceof Error ? err.message : String(err);
            if (step.onError === 'skip') {
                return { stepId: step.id, status: 'skipped', error: lastError, durationMs: 0 };
            }
            return { stepId: step.id, status: 'error', error: lastError, durationMs: 0 };
        }
    }

    private async executeParallel(steps: WorkflowStep[], context: WorkflowContext): Promise<StepResult[]> {
        return Promise.all(steps.map((s) => this.executeStep(s, context)));
    }

    private async withTimeout<T>(promise: Promise<T>, ms: number, name: string): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`Step "${name}" timed out after ${ms}ms`)), ms);
            promise
                .then((v) => { clearTimeout(timer); resolve(v); })
                .catch((e) => { clearTimeout(timer); reject(e); });
        });
    }
}
