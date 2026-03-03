/**
 * CoreBlow — Provider Usage Tracker
 *
 * Tracks AI model usage across all providers: token counts,
 * request counts, costs, latency, and error rates.
 * Provides per-model, per-provider, and aggregate statistics.
 */

/** Single request usage record */
export interface UsageRecord {
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    latencyMs: number;
    success: boolean;
    timestamp: number;
    estimatedCostUsd?: number;
}

/** Aggregate stats */
export interface UsageStats {
    totalRequests: number;
    totalTokens: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCacheTokens: number;
    totalCostUsd: number;
    avgLatencyMs: number;
    errorCount: number;
    errorRate: number;
}

/** Cost per 1M tokens (input/output) in USD */
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4-turbo': { input: 10.00, output: 30.00 },
    'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
    'o1': { input: 15.00, output: 60.00 },
    'o1-mini': { input: 3.00, output: 12.00 },
    'o3-mini': { input: 1.10, output: 4.40 },
    'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
    'claude-3-7-sonnet-20250219': { input: 3.00, output: 15.00 },
    'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
    'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },
    'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
    'gemini-2.5-flash': { input: 0.15, output: 0.60 },
    'gemini-2.5-pro': { input: 1.25, output: 10.00 },
    'gemini-2.0-flash': { input: 0.10, output: 0.40 },
    'gemini-1.5-pro': { input: 1.25, output: 5.00 },
    'gemini-1.5-flash': { input: 0.075, output: 0.30 },
};

/**
 * CoreBlow Usage Tracker
 */
export class UsageTracker {
    private records: UsageRecord[] = [];
    private maxRecords = 10_000;

    /**
     * Record a usage event.
     */
    record(usage: Omit<UsageRecord, 'timestamp' | 'estimatedCostUsd'>): UsageRecord {
        const cost = this.estimateCost(usage.model, usage.inputTokens, usage.outputTokens);
        const record: UsageRecord = {
            ...usage,
            timestamp: Date.now(),
            estimatedCostUsd: cost,
        };

        this.records.push(record);
        if (this.records.length > this.maxRecords) {
            this.records = this.records.slice(-this.maxRecords);
        }

        return record;
    }

    /**
     * Get aggregate stats.
     */
    getStats(filter?: { provider?: string; model?: string; since?: number }): UsageStats {
        let records = this.records;
        if (filter?.provider) records = records.filter((r) => r.provider === filter.provider);
        if (filter?.model) records = records.filter((r) => r.model === filter.model);
        if (filter?.since) records = records.filter((r) => r.timestamp >= filter.since!);

        const totalRequests = records.length;
        const errors = records.filter((r) => !r.success);

        return {
            totalRequests,
            totalTokens: records.reduce((s, r) => s + r.totalTokens, 0),
            totalInputTokens: records.reduce((s, r) => s + r.inputTokens, 0),
            totalOutputTokens: records.reduce((s, r) => s + r.outputTokens, 0),
            totalCacheTokens: records.reduce((s, r) => s + (r.cacheReadTokens ?? 0), 0),
            totalCostUsd: records.reduce((s, r) => s + (r.estimatedCostUsd ?? 0), 0),
            avgLatencyMs: totalRequests > 0
                ? records.reduce((s, r) => s + r.latencyMs, 0) / totalRequests
                : 0,
            errorCount: errors.length,
            errorRate: totalRequests > 0 ? errors.length / totalRequests : 0,
        };
    }

    /**
     * Get per-model breakdown.
     */
    getModelBreakdown(): Array<{ model: string; provider: string } & UsageStats> {
        const groups = new Map<string, UsageRecord[]>();
        for (const r of this.records) {
            const key = `${r.provider}:${r.model}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(r);
        }

        return Array.from(groups.entries()).map(([key, records]) => {
            const [provider, model] = key.split(':');
            return {
                model: model!,
                provider: provider!,
                ...this.computeStats(records),
            };
        });
    }

    /**
     * Get total estimated cost.
     */
    getTotalCost(since?: number): number {
        let records = this.records;
        if (since) records = records.filter((r) => r.timestamp >= since);
        return records.reduce((s, r) => s + (r.estimatedCostUsd ?? 0), 0);
    }

    /**
     * Get recent records.
     */
    getRecent(limit: number = 20): UsageRecord[] {
        return this.records.slice(-limit);
    }

    /**
     * Reset all records.
     */
    reset(): void {
        this.records = [];
    }

    // === Private ===

    private estimateCost(model: string, inputTokens: number, outputTokens: number): number {
        const costs = MODEL_COSTS[model];
        if (!costs) return 0;
        return (inputTokens / 1_000_000) * costs.input + (outputTokens / 1_000_000) * costs.output;
    }

    private computeStats(records: UsageRecord[]): UsageStats {
        const errors = records.filter((r) => !r.success);
        return {
            totalRequests: records.length,
            totalTokens: records.reduce((s, r) => s + r.totalTokens, 0),
            totalInputTokens: records.reduce((s, r) => s + r.inputTokens, 0),
            totalOutputTokens: records.reduce((s, r) => s + r.outputTokens, 0),
            totalCacheTokens: records.reduce((s, r) => s + (r.cacheReadTokens ?? 0), 0),
            totalCostUsd: records.reduce((s, r) => s + (r.estimatedCostUsd ?? 0), 0),
            avgLatencyMs: records.length > 0
                ? records.reduce((s, r) => s + r.latencyMs, 0) / records.length
                : 0,
            errorCount: errors.length,
            errorRate: records.length > 0 ? errors.length / records.length : 0,
        };
    }
}
