/** Test helpers for live/integration tests. */
export function createMockResponse(content: string) { return { id: 'mock', content: [{ type: 'text', text: content }], model: 'mock', usage: { input_tokens: 10, output_tokens: 5 } }; }
export function waitMs(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }
