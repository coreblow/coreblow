/**
 * tts/queue.ts
 */
export class TTSQueue { private queue: Array<{text: string; voice: string; resolve: Function}> = []; private processing = false; add(text: string, voice: string): Promise<Buffer> { return new Promise(resolve => { this.queue.push({text, voice, resolve}); if (!this.processing) this.processNext(); }); } private async processNext() { this.processing = true; while (this.queue.length > 0) { const item = this.queue.shift()!; item.resolve(Buffer.alloc(0)); } this.processing = false; } }
