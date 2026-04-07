/** PI embedded API payload construction. */
export interface ApiPayload { model: string; messages: Array<{ role: string; content: unknown }>; max_tokens?: number; tools?: unknown[]; }
export function buildPayload(model: string, messages: Array<{ role: string; content: unknown }>, maxTokens?: number): ApiPayload { return { model, messages, max_tokens: maxTokens }; }
