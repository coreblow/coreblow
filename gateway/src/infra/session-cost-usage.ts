/** CoreBlow — Session Cost Usage */
import type { SessionCost } from "./session-cost-usage.types.js";
const costs: SessionCost[] = [];
export function recordSessionCost(cost: SessionCost): void { costs.push(cost); }
export function getSessionCosts(sessionId: string): SessionCost[] { return costs.filter((c) => c.sessionId === sessionId); }
export function getTotalCostUsd(sessionId?: string): number { const filtered = sessionId ? costs.filter((c) => c.sessionId === sessionId) : costs; return filtered.reduce((sum, c) => sum + c.costUsd, 0); }
export function clearSessionCosts(): void { costs.length = 0; }
