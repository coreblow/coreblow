/** Subagent registry memory management. */
export function estimateEntryMemory(entry: { messages?: unknown[]; aggregated?: string }): number {
    let bytes = 200;
    if (entry.messages) bytes += entry.messages.length * 500;
    if (entry.aggregated) bytes += entry.aggregated.length * 2;
    return bytes;
}
