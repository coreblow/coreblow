/** Raw SSE stream parsing. */
export function parseSSELine(line: string): { event?: string; data?: string } | null {
    if (line.startsWith('event: ')) return { event: line.slice(7) };
    if (line.startsWith('data: ')) return { data: line.slice(6) };
    return null;
}
