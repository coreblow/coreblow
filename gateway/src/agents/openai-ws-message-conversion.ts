/** OpenAI WS message format conversion. */
export function convertWsToContentBlock(msg: Record<string, unknown>): { type: string; content?: string } {
    const type = msg.type as string;
    if (type === 'response.text.delta') return { type: 'text', content: msg.delta as string };
    if (type === 'response.done') return { type: 'done' };
    return { type: 'unknown' };
}
