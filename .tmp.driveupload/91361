/** Tool result guard — validate results before sending. */
export function guardToolResult(result: string, maxLen = 200_000): { content: string; truncated: boolean } {
    if (result.length <= maxLen) return { content: result, truncated: false };
    return { content: result.slice(0, maxLen) + '\n[truncated]', truncated: true };
}
