/** CoreBlow — PI Run Types */ export interface RunResult { success: boolean; output?: string; error?: string; usage?: { inputTokens: number; outputTokens: number }; }
