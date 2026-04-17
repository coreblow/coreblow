/**
 * CoreBlow — Stream Processor
 *
 * Processes streaming data (SSE, WebSocket, chunked responses)
 * with buffering, transformation, back-pressure, and
 * token-level streaming for AI model responses.
 */

/** Stream chunk */
export interface StreamChunk {
    type: 'text' | 'tool_call' | 'done' | 'error';
    content?: string;
    toolCallId?: string;
    toolName?: string;
    toolArgs?: string;
    finishReason?: string;
    usage?: { input: number; output: number };
}

/** Stream handler */
export type StreamHandler = (chunk: StreamChunk) => void | Promise<void>;

/** Stream options */
export interface StreamOptions {
    /** Buffer size before flushing */
    bufferSize?: number;
    /** Flush interval (ms) */
    flushIntervalMs?: number;
    /** Transform function applied to each chunk */
    transform?: (chunk: StreamChunk) => StreamChunk | null;
}

/**
 * CoreBlow Stream Processor
 */
export class StreamProcessor {
    private handlers: StreamHandler[] = [];
    private buffer: StreamChunk[] = [];
    private options: Required<StreamOptions>;
    private flushTimer: ReturnType<typeof setInterval> | null = null;
    private totalChunks = 0;
    private totalBytes = 0;
    private active = false;

    constructor(opts?: StreamOptions) {
        this.options = {
            bufferSize: opts?.bufferSize ?? 1,
            flushIntervalMs: opts?.flushIntervalMs ?? 50,
            transform: opts?.transform ?? ((c) => c),
        };
    }

    /**
     * Add a stream handler.
     */
    onChunk(handler: StreamHandler): void {
        this.handlers.push(handler);
    }

    /**
     * Start the stream processor.
     */
    start(): void {
        this.active = true;
        if (this.options.flushIntervalMs > 0 && this.options.bufferSize > 1) {
            this.flushTimer = setInterval(() => this.flush(), this.options.flushIntervalMs);
        }
    }

    /**
     * Push a chunk into the stream.
     */
    async push(chunk: StreamChunk): Promise<void> {
        const transformed = this.options.transform(chunk);
        if (!transformed) return;

        this.totalChunks++;
        this.totalBytes += (transformed.content?.length ?? 0);

        if (this.options.bufferSize <= 1) {
            await this.dispatch(transformed);
        } else {
            this.buffer.push(transformed);
            if (this.buffer.length >= this.options.bufferSize) {
                await this.flush();
            }
        }
    }

    /**
     * Flush buffered chunks.
     */
    async flush(): Promise<void> {
        const chunks = [...this.buffer];
        this.buffer = [];
        for (const chunk of chunks) {
            await this.dispatch(chunk);
        }
    }

    /**
     * End the stream.
     */
    async end(usage?: { input: number; output: number }): Promise<void> {
        await this.flush();
        await this.push({ type: 'done', finishReason: 'stop', usage });
        this.stop();
    }

    /**
     * Stop the processor.
     */
    stop(): void {
        this.active = false;
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
    }

    /**
     * Get stream stats.
     */
    getStats(): { totalChunks: number; totalBytes: number; active: boolean; buffered: number } {
        return {
            totalChunks: this.totalChunks,
            totalBytes: this.totalBytes,
            active: this.active,
            buffered: this.buffer.length,
        };
    }

    /**
     * Parse SSE (Server-Sent Events) text into chunks.
     */
    static parseSSE(text: string): StreamChunk[] {
        const chunks: StreamChunk[] = [];
        const lines = text.split('\n');

        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
                chunks.push({ type: 'done', finishReason: 'stop' });
                continue;
            }
            try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;
                if (delta?.content) {
                    chunks.push({ type: 'text', content: delta.content });
                } else if (delta?.tool_calls?.[0]) {
                    const tc = delta.tool_calls[0];
                    chunks.push({
                        type: 'tool_call',
                        toolCallId: tc.id,
                        toolName: tc.function?.name,
                        toolArgs: tc.function?.arguments,
                    });
                }
            } catch { /* skip invalid */ }
        }
        return chunks;
    }

    // === Private ===

    private async dispatch(chunk: StreamChunk): Promise<void> {
        for (const handler of this.handlers) {
            try { await handler(chunk); } catch { /* skip */ }
        }
    }
}
