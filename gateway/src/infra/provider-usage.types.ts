/** CoreBlow — Provider Usage Types */
export interface ProviderUsageRecord { provider: string; model: string; inputTokens: number; outputTokens: number; costUsd?: number; timestamp: number; sessionId?: string; }
export interface ProviderUsageSummary { provider: string; totalRequests: number; totalInputTokens: number; totalOutputTokens: number; totalCostUsd: number; }
