/** OpenAI WebSocket connection management. */
export interface WsConnectionConfig { url: string; apiKey: string; model: string; }
export function buildWsUrl(config: WsConnectionConfig): string { return `${config.url}?model=${encodeURIComponent(config.model)}`; }
export function createWsHeaders(apiKey: string): Record<string, string> { return { 'Authorization': `Bearer ${apiKey}`, 'OpenAI-Beta': 'realtime=v1' }; }
