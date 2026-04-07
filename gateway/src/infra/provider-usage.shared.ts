/**
 * infra/provider-usage.shared.ts
 * Provider usage accounting shared between infra monitoring & billing.
 */

export type UsageRecord = {
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    timestamp: number;
};

/** Calculate cost from token counts. */
export function estimateCost(
    inputTokens: number,
    outputTokens: number,
    inputPricePer1k: number,
    outputPricePer1k: number,
): number {
    return (inputTokens / 1000) * inputPricePer1k + (outputTokens / 1000) * outputPricePer1k;
}

/** Aggregate usage records by provider. */
export function aggregateByProvider(records: UsageRecord[]): Record<string, { totalTokens: number; totalCost: number; count: number }> {
    const result: Record<string, { totalTokens: number; totalCost: number; count: number }> = {};
    for (const r of records) {
        if (!result[r.provider]) result[r.provider] = { totalTokens: 0, totalCost: 0, count: 0 };
        result[r.provider].totalTokens += r.inputTokens + r.outputTokens;
        result[r.provider].totalCost += r.costUsd;
        result[r.provider].count++;
    }
    return result;
}

/** Format cost as currency string. */
export function formatCost(usd: number): string {
    return `$${usd.toFixed(4)}`;
}
