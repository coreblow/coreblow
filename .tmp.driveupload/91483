/**
 * agents/tool-display.ts
 * Format tool calls/results for display.
 */
export function formatToolCall(name: string, args: Record<string, unknown>): string {
    const argStr = Object.entries(args).map(([k, v]) => `${k}=${typeof v === 'string' ? `"${v.slice(0, 100)}"` : JSON.stringify(v)}`).join(', ');
    return `${name}(${argStr})`;
}
export function formatToolResult(name: string, result: string, maxLen = 200): string {
    const truncated = result.length > maxLen ? result.slice(0, maxLen) + `... (${result.length} chars)` : result;
    return `← ${name}: ${truncated}`;
}
export function formatToolCallBrief(name: string): string { return `🔧 ${name}`; }
export function formatToolError(name: string, error: string): string { return `❌ ${name}: ${error}`; }
export function formatToolCallId(id: string): string { return id.length > 12 ? id.slice(0, 12) + '…' : id; }
