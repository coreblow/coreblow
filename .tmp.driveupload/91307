/** Tool result state tracking. */
const toolResultState = new Map<string, { count: number; totalChars: number }>();
export function recordToolResult(sessionId: string, chars: number): void { const s = toolResultState.get(sessionId) ?? { count: 0, totalChars: 0 }; s.count++; s.totalChars += chars; toolResultState.set(sessionId, s); }
export function getToolResultState(sessionId: string): { count: number; totalChars: number } { return toolResultState.get(sessionId) ?? { count: 0, totalChars: 0 }; }
export function clearToolResultState(): void { toolResultState.clear(); }
