/**
 * agents/usage.ts
 * Token/cost usage tracking and formatting.
 */
export interface UsageRecord { inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheWriteTokens?: number; cost?: number; model?: string; provider?: string; timestamp: number; }
export interface UsageSummary { totalInputTokens: number; totalOutputTokens: number; totalCacheReadTokens: number; totalCacheWriteTokens: number; totalCost: number; turns: number; byModel: Map<string, { input: number; output: number; cost: number; count: number }>; startedAt: number; lastActivityAt: number; }

export class UsageTracker {
    private records: UsageRecord[] = [];
    record(r: Omit<UsageRecord, 'timestamp'>): void { this.records.push({ ...r, timestamp: Date.now() }); }
    getSummary(): UsageSummary {
        const byModel = new Map<string, { input: number; output: number; cost: number; count: number }>();
        let ti = 0, to = 0, tcr = 0, tcw = 0, tc = 0;
        for (const r of this.records) {
            ti += r.inputTokens; to += r.outputTokens; tcr += r.cacheReadTokens ?? 0; tcw += r.cacheWriteTokens ?? 0; tc += r.cost ?? 0;
            const key = r.model ?? 'unknown';
            const existing = byModel.get(key) ?? { input: 0, output: 0, cost: 0, count: 0 };
            existing.input += r.inputTokens; existing.output += r.outputTokens; existing.cost += r.cost ?? 0; existing.count++;
            byModel.set(key, existing);
        }
        return { totalInputTokens: ti, totalOutputTokens: to, totalCacheReadTokens: tcr, totalCacheWriteTokens: tcw, totalCost: tc, turns: this.records.length, byModel, startedAt: this.records[0]?.timestamp ?? Date.now(), lastActivityAt: this.records.at(-1)?.timestamp ?? Date.now() };
    }
    format(): string {
        const s = this.getSummary();
        const lines = [`Tokens: ${(s.totalInputTokens + s.totalOutputTokens).toLocaleString()} (${s.totalInputTokens.toLocaleString()} in / ${s.totalOutputTokens.toLocaleString()} out)`, `Cost: $${s.totalCost.toFixed(4)}`, `Turns: ${s.turns}`];
        if (s.totalCacheReadTokens > 0) lines.push(`Cache: ${s.totalCacheReadTokens.toLocaleString()} read / ${s.totalCacheWriteTokens.toLocaleString()} write`);
        return lines.join('\n');
    }
    reset(): void { this.records = []; }
    getRecords(): readonly UsageRecord[] { return this.records; }
}
