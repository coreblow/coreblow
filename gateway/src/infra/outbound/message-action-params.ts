/** CoreBlow — Message Action Params */
export interface ActionParams { actionId: string; type: string; data: Record<string, unknown>; }
export function validateActionParams(params: unknown): params is ActionParams { if (typeof params !== "object" || params === null) return false; const p = params as Record<string, unknown>; return typeof p.actionId === "string" && typeof p.type === "string"; }
