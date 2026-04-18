/** CoreBlow — PI Logging Hook */ export function logAgentAction(agentId: string, action: string, details?: unknown): void { console.log("[agent:" + agentId + "] " + action); }
