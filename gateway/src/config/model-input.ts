/** CoreBlow — Model Input Config */
export interface ModelInput { provider: string; model: string; temperature?: number; maxTokens?: number; topP?: number; }
export function resolveModelInput(config: Record<string, unknown>): ModelInput { return { provider: String(config.provider ?? "anthropic"), model: String(config.model ?? "claude-sonnet-4-20250514"), temperature: Number(config.temperature ?? 0.7), maxTokens: Number(config.maxTokens ?? 8192) }; }
