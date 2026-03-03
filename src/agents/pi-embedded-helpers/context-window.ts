/** CoreBlow — PI Context Window */ export function calculateContextWindow(maxTokens: number, usedTokens: number): number { return Math.max(0, maxTokens - usedTokens); }
