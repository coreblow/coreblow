/** PI embedded content block chunking. */
export function chunkBlocks(blocks: unknown[], maxPerChunk = 10): unknown[][] { const chunks: unknown[][] = []; for (let i = 0; i < blocks.length; i += maxPerChunk) chunks.push(blocks.slice(i, i + maxPerChunk)); return chunks; }
