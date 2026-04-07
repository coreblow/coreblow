/**
 * CoreBlow — Stream Processor
 *
 * Processes streaming AI responses with token-by-token
 * handling, content buffering, tool call detection,
 * and stream statistics.
 */

/** Stream chunk */
export interface StreamChunk {
    type: 'text' | 'tool_call' | 'metadata' | 'done' | 'error';
    content: string;
    index: number;
    timestamp: number;
}

/** Stream session */
export interface StreamSession {
    id: string;
    status: 'active' | 'completed' | 'error';
    chunks: StreamChunk[];
    totalTokens: number;
    startedAt: number;
    completedAt?: number;
    fullContent: string;
}

/**
 * CoreBlow Stream Processor
 */
export class StreamProcessor {
    private sessions = new Map<string, StreamSession>();
    private idCounter = 0;
    private listeners = new Map<string, Array<(chunk: StreamChunk) => void>>();

    /**
     * Start a new stream session.
     */
    startSession(): StreamSession {
        const id = `stream-${++this.idCounter}`;
        const session: StreamSession = {
            id, status: 'active', chunks: [],
            totalTokens: 0, startedAt: Date.now(), fullContent: '',
        };
        this.sessions.set(id, session);
        return session;
    }

    /**
     * Push a chunk to stream.
     */
    push(sessionId: string, type: StreamChunk['type'], content: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session || session.status !== 'active') return false;

        const chunk: StreamChunk = {
            type, content, index: session.chunks.length, timestamp: Date.now(),
        };
        session.chunks.push(chunk);

        if (type === 'text') {
            session.fullContent += content;
            session.totalTokens += Math.ceil(content.length / 4);
        }

        if (type === 'done') {
            session.status = 'completed';
            session.completedAt = Date.now();
        } else if (type === 'error') {
            session.status = 'error';
            session.completedAt = Date.now();
        }

        // Notify listeners
        const fns = this.listeners.get(sessionId) ?? [];
        for (const fn of fns) fn(chunk);

        return true;
    }

    /**
     * Subscribe to stream chunks.
     */
    onChunk(sessionId: string, callback: (chunk: StreamChunk) => void): void {
        if (!this.listeners.has(sessionId)) this.listeners.set(sessionId, []);
        this.listeners.get(sessionId)!.push(callback);
    }

    /**
     * Get full content so far.
     */
    getContent(sessionId: string): string {
        return this.sessions.get(sessionId)?.fullContent ?? '';
    }

    /**
     * Get session.
     */
    get(sessionId: string): StreamSession | null {
        return this.sessions.get(sessionId) ?? null;
    }

    /**
     * Get stream stats.
     */
    getSessionStats(sessionId: string): { chunks: number; tokens: number; durationMs: number } | null {
        const session = this.sessions.get(sessionId);
        if (!session) return null;
        return {
            chunks: session.chunks.length,
            tokens: session.totalTokens,
            durationMs: (session.completedAt ?? Date.now()) - session.startedAt,
        };
    }

    /**
     * Clean up completed sessions.
     */
    cleanup(): number {
        let count = 0;
        for (const [id, session] of Array.from(this.sessions)) {
            if (session.status === 'completed' || session.status === 'error') {
                this.sessions.delete(id);
                this.listeners.delete(id);
                count++;
            }
        }
        return count;
    }

    /** Count */
    count(): number { return this.sessions.size; }
}
