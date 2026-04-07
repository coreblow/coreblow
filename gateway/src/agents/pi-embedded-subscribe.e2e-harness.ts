/** E2E test harness for subscribe. */
export function createMockStream(chunks: string[]): AsyncIterable<string> { return { async *[Symbol.asyncIterator]() { for (const c of chunks) yield c; } }; }
