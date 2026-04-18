/**
 * agents/bootstrap-budget.ts
 * Token/cost budget tracking and enforcement for agent turns.
 * Ported from CoreBlow src/agents/bootstrap-budget.ts.
 */

export interface BudgetConfig {
    maxTokensPerTurn: number;
    maxTokensPerSession: number;
    maxCostPerTurn: number;
    maxCostPerSession: number;
    warningThresholdPct: number;
}

export interface BudgetSnapshot {
    turnTokens: number;
    sessionTokens: number;
    turnCost: number;
    sessionCost: number;
    turnPct: number;
    sessionPct: number;
    exceeded: boolean;
    warnings: string[];
}

const DEFAULT_BUDGET: BudgetConfig = {
    maxTokensPerTurn: 200_000,
    maxTokensPerSession: 2_000_000,
    maxCostPerTurn: 5.0,
    maxCostPerSession: 50.0,
    warningThresholdPct: 80,
};

export class BudgetTracker {
    private config: BudgetConfig;
    private turnTokens = 0;
    private sessionTokens = 0;
    private turnCost = 0;
    private sessionCost = 0;

    constructor(config?: Partial<BudgetConfig>) {
        this.config = { ...DEFAULT_BUDGET, ...config };
    }

    record(params: { inputTokens: number; outputTokens: number; cost?: number }): void {
        const tokens = params.inputTokens + params.outputTokens;
        this.turnTokens += tokens;
        this.sessionTokens += tokens;
        if (params.cost !== undefined) {
            this.turnCost += params.cost;
            this.sessionCost += params.cost;
        }
    }

    resetTurn(): void { this.turnTokens = 0; this.turnCost = 0; }

    snapshot(): BudgetSnapshot {
        const turnPct = Math.min(100, this.config.maxTokensPerTurn > 0 ? (this.turnTokens / this.config.maxTokensPerTurn) * 100 : 0);
        const sessionPct = Math.min(100, this.config.maxTokensPerSession > 0 ? (this.sessionTokens / this.config.maxTokensPerSession) * 100 : 0);
        const exceeded = this.turnTokens >= this.config.maxTokensPerTurn || this.sessionTokens >= this.config.maxTokensPerSession || this.turnCost >= this.config.maxCostPerTurn || this.sessionCost >= this.config.maxCostPerSession;
        const warnings: string[] = [];
        if (turnPct >= this.config.warningThresholdPct) warnings.push(`Turn token budget at ${turnPct.toFixed(0)}%`);
        if (sessionPct >= this.config.warningThresholdPct) warnings.push(`Session token budget at ${sessionPct.toFixed(0)}%`);
        if (this.config.maxCostPerTurn > 0 && this.turnCost / this.config.maxCostPerTurn >= this.config.warningThresholdPct / 100) warnings.push(`Turn cost at $${this.turnCost.toFixed(2)}`);
        return { turnTokens: this.turnTokens, sessionTokens: this.sessionTokens, turnCost: this.turnCost, sessionCost: this.sessionCost, turnPct, sessionPct, exceeded, warnings };
    }

    isExceeded(): boolean { return this.snapshot().exceeded; }

    formatStatus(): string {
        const s = this.snapshot();
        return `Tokens: ${s.turnTokens.toLocaleString()}/${this.config.maxTokensPerTurn.toLocaleString()} (turn) | ${s.sessionTokens.toLocaleString()}/${this.config.maxTokensPerSession.toLocaleString()} (session) | Cost: $${s.turnCost.toFixed(3)} (turn) / $${s.sessionCost.toFixed(3)} (session)`;
    }
}

export function resolveBudgetConfig(cfg?: Record<string, unknown>): BudgetConfig {
    const budget = (cfg?.agents as Record<string, unknown> | undefined)?.budget as Record<string, unknown> | undefined;
    if (!budget) return { ...DEFAULT_BUDGET };
    return {
        maxTokensPerTurn: typeof budget.maxTokensPerTurn === 'number' ? budget.maxTokensPerTurn : DEFAULT_BUDGET.maxTokensPerTurn,
        maxTokensPerSession: typeof budget.maxTokensPerSession === 'number' ? budget.maxTokensPerSession : DEFAULT_BUDGET.maxTokensPerSession,
        maxCostPerTurn: typeof budget.maxCostPerTurn === 'number' ? budget.maxCostPerTurn : DEFAULT_BUDGET.maxCostPerTurn,
        maxCostPerSession: typeof budget.maxCostPerSession === 'number' ? budget.maxCostPerSession : DEFAULT_BUDGET.maxCostPerSession,
        warningThresholdPct: typeof budget.warningThresholdPct === 'number' ? budget.warningThresholdPct : DEFAULT_BUDGET.warningThresholdPct,
    };
}
