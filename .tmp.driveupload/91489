/**
 * agents/tool-summaries.ts
 * Generate concise summaries of tool results.
 */
export function summarizeToolResult(toolName: string, result: string, maxLen = 150): string {
    if (!result || result.trim().length === 0) return `${toolName}: (empty result)`;
    const cleaned = result.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= maxLen) return `${toolName}: ${cleaned}`;
    return `${toolName}: ${cleaned.slice(0, maxLen)}… (${result.length} chars)`;
}
export function summarizeToolError(toolName: string, error: string): string { return `${toolName} failed: ${error.split('\n')[0].slice(0, 200)}`; }
export function summarizeExecResult(command: string, exitCode: number | null, output: string, maxLen = 100): string {
    const status = exitCode === 0 ? '✓' : `✗ (${exitCode})`;
    const cmd = command.length > 50 ? command.slice(0, 50) + '…' : command;
    const out = output.trim().split('\n').pop()?.slice(0, maxLen) ?? '';
    return `${status} ${cmd}${out ? ` → ${out}` : ''}`;
}
export function buildToolResultsDigest(results: Array<{ tool: string; result: string }>): string {
    return results.map((r) => summarizeToolResult(r.tool, r.result, 80)).join('\n');
}
