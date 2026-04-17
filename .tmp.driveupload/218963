/**
 * CoreBlow — Sub-Agent Orchestrator
 *
 * Coordinates multiple specialized sub-agents for complex tasks.
 * Supports parallel execution, sequential chains, result aggregation,
 * and agent routing based on task type.
 */

/** Sub-agent definition */
export interface SubAgent {
    id: string;
    name: string;
    description: string;
    capabilities: string[];
    handler: (input: SubAgentInput) => Promise<SubAgentOutput>;
    priority?: number;
    maxConcurrent?: number;
}

/** Input to sub-agent */
export interface SubAgentInput {
    task: string;
    context?: Record<string, unknown>;
    parentAgentId?: string;
    conversationId?: string;
}

/** Output from sub-agent */
export interface SubAgentOutput {
    agentId: string;
    result: string;
    confidence: number;
    metadata?: Record<string, unknown>;
    durationMs: number;
}

/** Orchestration result */
export interface OrchestrationResult {
    strategy: 'single' | 'parallel' | 'chain';
    results: SubAgentOutput[];
    finalOutput: string;
    totalDurationMs: number;
}

/**
 * CoreBlow Sub-Agent Orchestrator
 */
export class SubAgentOrchestrator {
    private agents = new Map<string, SubAgent>();
    private history: OrchestrationResult[] = [];
    private maxHistory = 50;

    /**
     * Register a sub-agent.
     */
    register(agent: SubAgent): void {
        this.agents.set(agent.id, agent);
    }

    /**
     * Route to the best agent for a task.
     */
    route(task: string): SubAgent | null {
        const lower = task.toLowerCase();
        let best: SubAgent | null = null;
        let bestScore = 0;

        for (const agent of Array.from(this.agents.values())) {
            let score = 0;
            for (const cap of agent.capabilities) {
                if (lower.includes(cap.toLowerCase())) score++;
            }
            score += (agent.priority ?? 0) * 0.1;
            if (score > bestScore) { bestScore = score; best = agent; }
        }
        return best;
    }

    /**
     * Execute a single agent.
     */
    async executeSingle(agentId: string, input: SubAgentInput): Promise<SubAgentOutput | null> {
        const agent = this.agents.get(agentId);
        if (!agent) return null;

        const start = Date.now();
        try {
            const result = await agent.handler(input);
            result.durationMs = Date.now() - start;
            return result;
        } catch (err) {
            return {
                agentId,
                result: `Error: ${err instanceof Error ? err.message : String(err)}`,
                confidence: 0,
                durationMs: Date.now() - start,
            };
        }
    }

    /**
     * Execute multiple agents in parallel.
     */
    async executeParallel(agentIds: string[], input: SubAgentInput): Promise<OrchestrationResult> {
        const start = Date.now();
        const results = await Promise.all(
            agentIds.map((id) => this.executeSingle(id, input)),
        );

        const validResults = results.filter((r): r is SubAgentOutput => r !== null);
        const best = validResults.sort((a, b) => b.confidence - a.confidence)[0];

        const result: OrchestrationResult = {
            strategy: 'parallel',
            results: validResults,
            finalOutput: best?.result ?? 'No results',
            totalDurationMs: Date.now() - start,
        };

        this.record(result);
        return result;
    }

    /**
     * Execute agents in a chain (output → input).
     */
    async executeChain(agentIds: string[], initialInput: SubAgentInput): Promise<OrchestrationResult> {
        const start = Date.now();
        const results: SubAgentOutput[] = [];
        let currentInput = initialInput;

        for (const id of agentIds) {
            const output = await this.executeSingle(id, currentInput);
            if (!output) break;
            results.push(output);
            currentInput = { ...currentInput, task: output.result, context: { ...currentInput.context, previousResult: output.result } };
        }

        const lastResult = results[results.length - 1];
        const result: OrchestrationResult = {
            strategy: 'chain',
            results,
            finalOutput: lastResult?.result ?? 'Chain failed',
            totalDurationMs: Date.now() - start,
        };

        this.record(result);
        return result;
    }

    /**
     * Auto-route and execute.
     */
    async autoExecute(input: SubAgentInput): Promise<OrchestrationResult> {
        const agent = this.route(input.task);
        if (!agent) {
            return { strategy: 'single', results: [], finalOutput: 'No suitable agent found', totalDurationMs: 0 };
        }

        const output = await this.executeSingle(agent.id, input);
        const result: OrchestrationResult = {
            strategy: 'single',
            results: output ? [output] : [],
            finalOutput: output?.result ?? 'Execution failed',
            totalDurationMs: output?.durationMs ?? 0,
        };

        this.record(result);
        return result;
    }

    /**
     * List registered agents.
     */
    list(): Array<{ id: string; name: string; capabilities: string[] }> {
        return Array.from(this.agents.values()).map((a) => ({
            id: a.id,
            name: a.name,
            capabilities: a.capabilities,
        }));
    }

    /**
     * Get history.
     */
    getHistory(limit?: number): OrchestrationResult[] {
        return this.history.slice(-(limit ?? 20));
    }

    /** Count */
    count(): number { return this.agents.size; }

    // === Private ===

    private record(result: OrchestrationResult): void {
        this.history.push(result);
        if (this.history.length > this.maxHistory) this.history = this.history.slice(-this.maxHistory);
    }
}
