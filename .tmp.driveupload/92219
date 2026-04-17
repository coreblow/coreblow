/**
 * tts/streaming.ts
 */
export class TTSStreamer { private chunks: Buffer[] = []; addChunk(chunk: Buffer) { this.chunks.push(chunk); } flush(): Buffer { return Buffer.concat(this.chunks); } clear() { this.chunks = []; } }
