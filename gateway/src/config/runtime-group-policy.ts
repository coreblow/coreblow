/** CoreBlow — Runtime Group Policy */
export interface GroupPolicy { groupId: string; maxSessions: number; maxTokensPerDay: number; allowedModels: string[]; }
export function enforceGroupPolicy(policy: GroupPolicy, currentSessions: number): boolean { return currentSessions < policy.maxSessions; }
