/** Compaction test helpers. */
export function createTestMessages(count: number): Array<{ role: string; content: string; timestamp: number }> {
    return Array.from({ length: count }, (_, i) => ({ role: i % 2 === 0 ? 'user' : 'assistant', content: `Message ${i}`, timestamp: Date.now() + i }));
}
