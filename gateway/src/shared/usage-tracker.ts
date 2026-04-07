/**
 * src/shared/usage-tracker.ts
 * Usage data aggregation and tracking.
 * Ported from CoreBlow shared/usage-aggregates.ts and shared/usage-types.ts.
 */

// ── Types ──

export type UsageRecord = {
    model: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    timestamp: number;
};

export type LatencyTotalsLike = {
    count: number;
    sum: number;
    min: number;
    max: number;
    p95Max: number;
};

export type DailyLatencyLike = {
    date: string;
    count: number;
    sum: number;
    min: number;
    max: number;
    p95Max: number;
};

export type DailyLike = {
    date: string;
};

export type LatencyLike = {
    count: number;
    avgMs: number;
    minMs: number;
    maxMs: number;
    p95Ms: number;
};

export type DailyLatencyInput = LatencyLike & { date: string };

// ── Aggregation Logic ──

export function mergeUsageLatency(
    totals: LatencyTotalsLike,
    latency: LatencyLike | undefined,
): void {
    if (!latency || latency.count <= 0) return;
    
    totals.count += latency.count;
    totals.sum += latency.avgMs * latency.count;
    totals.min = Math.min(totals.min, latency.minMs);
    totals.max = Math.max(totals.max, latency.maxMs);
    totals.p95Max = Math.max(totals.p95Max, latency.p95Ms);
}

export function mergeUsageDailyLatency(
    dailyLatencyMap: Map<string, DailyLatencyLike>,
    dailyLatency?: DailyLatencyInput[] | null,
): void {
    for (const day of dailyLatency ?? []) {
        const existing = dailyLatencyMap.get(day.date) ?? {
            date: day.date,
            count: 0,
            sum: 0,
            min: Number.POSITIVE_INFINITY,
            max: 0,
            p95Max: 0,
        };
        existing.count += day.count;
        existing.sum += day.avgMs * day.count;
        existing.min = Math.min(existing.min, day.minMs);
        existing.max = Math.max(existing.max, day.maxMs);
        existing.p95Max = Math.max(existing.p95Max, day.p95Ms);
        dailyLatencyMap.set(day.date, existing);
    }
}

export function buildUsageAggregateTail<
    TTotals extends { totalCost: number },
    TDaily extends DailyLike,
    TModelDaily extends { date: string; cost: number },
>(params: {
    byChannelMap: Map<string, TTotals>;
    latencyTotals: LatencyTotalsLike;
    dailyLatencyMap: Map<string, DailyLatencyLike>;
    modelDailyMap: Map<string, TModelDaily>;
    dailyMap: Map<string, TDaily>;
}) {
    return {
        byChannel: Array.from(params.byChannelMap.entries())
            .map(([channel, totals]) => ({ channel, totals }))
            .sort((a, b) => b.totals.totalCost - a.totals.totalCost),
        latency: params.latencyTotals.count > 0
            ? {
                  count: params.latencyTotals.count,
                  avgMs: params.latencyTotals.sum / params.latencyTotals.count,
                  minMs: params.latencyTotals.min === Number.POSITIVE_INFINITY ? 0 : params.latencyTotals.min,
                  maxMs: params.latencyTotals.max,
                  p95Ms: params.latencyTotals.p95Max,
              }
            : undefined,
        dailyLatency: Array.from(params.dailyLatencyMap.values())
            .map((entry) => ({
                date: entry.date,
                count: entry.count,
                avgMs: entry.count ? entry.sum / entry.count : 0,
                minMs: entry.min === Number.POSITIVE_INFINITY ? 0 : entry.min,
                maxMs: entry.max,
                p95Ms: entry.p95Max,
            }))
            .sort((a, b) => a.date.localeCompare(b.date)),
        modelDaily: Array.from(params.modelDailyMap.values())
            .sort((a, b) => a.date.localeCompare(b.date) || b.cost - a.cost),
        daily: Array.from(params.dailyMap.values())
            .sort((a, b) => a.date.localeCompare(b.date)),
    };
}

// ── UsageTracker OOP Wrapper ──

export class UsageTracker {
    private records: UsageRecord[] = [];

    recordUsage(record: UsageRecord): void {
        this.records.push(record);
    }

    getUsageSummary(): { totalTokens: number; totalCost: number; recordCount: number } {
        let totalTokens = 0;
        let totalCost = 0;
        for (const record of this.records) {
            totalTokens += record.inputTokens + record.outputTokens;
            totalCost += record.cost;
        }
        return { totalTokens, totalCost, recordCount: this.records.length };
    }

    getUsageByModel(): Map<string, { tokens: number; cost: number }> {
        const map = new Map<string, { tokens: number; cost: number }>();
        for (const record of this.records) {
            const current = map.get(record.model) ?? { tokens: 0, cost: 0 };
            current.tokens += record.inputTokens + record.outputTokens;
            current.cost += record.cost;
            map.set(record.model, current);
        }
        return map;
    }

    resetUsage(): void {
        this.records = [];
    }

    exportUsage(): UsageRecord[] {
        return [...this.records];
    }
}
