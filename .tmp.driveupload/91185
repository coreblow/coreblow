/** Memory/conversation search. */
export function searchMessages(messages: Array<{ content: string }>, query: string): number[] {
    const q = query.toLowerCase();
    return messages.map((m, i) => m.content.toLowerCase().includes(q) ? i : -1).filter((i) => i >= 0);
}
