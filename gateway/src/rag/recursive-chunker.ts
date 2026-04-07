export interface ChunkConfig { maxChunkSize?: number; overlap?: number; separators?: string[]; }
export interface Chunk { content: string; index: number; metadata?: Record<string, unknown>; }
export function recursiveChunk(text: string, config: ChunkConfig = {}): Chunk[] { const max = config.maxChunkSize || 1000; const overlap = config.overlap || 100; const chunks: Chunk[] = []; let i = 0, idx = 0; while (i < text.length) { chunks.push({ content: text.slice(i, i + max), index: idx++ }); i += max - overlap; } return chunks; }
