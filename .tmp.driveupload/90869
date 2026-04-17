/** Model config planning. */
export interface ModelPlan { primary: string; fallbacks: string[]; maxRetries: number; }
export function createModelPlan(primary: string, fallbacks?: string[]): ModelPlan { return { primary, fallbacks: fallbacks ?? [], maxRetries: 3 }; }
