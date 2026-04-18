/** CoreBlow — Types: CoreBlow Root Config */
export interface CoreBlowConfig { version: number; provider: string; model: string; systemPrompt?: string; temperature?: number; maxTokens?: number; channels?: Record<string, unknown>; agents?: Record<string, unknown>; tools?: Record<string, unknown>; mcp?: Record<string, unknown>; gateway?: Record<string, unknown>; }
