/**
 * CoreBlow — Message Replay
 *
 * Records and replays messages for debugging,
 * testing, and disaster recovery scenarios.
 */

/** Recorded message */
export interface RecordedMessage {
    id: string;
    topic: string;
    payload: unknown;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

/** Replay result */
export interface ReplayResult {
    replayed: number;
    failed: number;
    duration: number;
}

/**
 * CoreBlow Message Replay
 */
export class MessageReplay {
    private recordings = new Map<string, RecordedMessage[]>();
    private idCounter = 0;
    private recording = false;
    private currentSession?: string;

    /**
     * Start recording.
     */
    startRecording(sessionId?: string): string {
        const id = sessionId ?? `session-${++this.idCounter}`;
        this.recordings.set(id, []);
        this.currentSession = id;
        this.recording = true;
        return id;
    }

    /**
     * Stop recording.
     */
    stopRecording(): string | null {
        this.recording = false;
        const session = this.currentSession;
        this.currentSession = undefined;
        return session ?? null;
    }

    /**
     * Record a message.
     */
    record(topic: string, payload: unknown, metadata?: Record<string, unknown>): boolean {
        if (!this.recording || !this.currentSession) return false;
        this.recordings.get(this.currentSession)!.push({
            id: `rec-${++this.idCounter}`, topic, payload, timestamp: Date.now(), metadata,
        });
        return true;
    }

    /**
     * Replay a session.
     */
    async replay(sessionId: string, handler: (msg: RecordedMessage) => Promise<void>): Promise<ReplayResult> {
        const messages = this.recordings.get(sessionId);
        if (!messages) return { replayed: 0, failed: 0, duration: 0 };

        const start = Date.now();
        let replayed = 0;
        let failed = 0;

        for (const msg of messages) {
            try { await handler(msg); replayed++; }
            catch { failed++; }
        }

        return { replayed, failed, duration: Date.now() - start };
    }

    /**
     * Get session messages.
     */
    getSession(sessionId: string): RecordedMessage[] {
        return this.recordings.get(sessionId) ?? [];
    }

    /**
     * Filter messages.
     */
    filter(sessionId: string, topic?: string, fromTs?: number, toTs?: number): RecordedMessage[] {
        let msgs = this.getSession(sessionId);
        if (topic) msgs = msgs.filter((m) => m.topic === topic);
        if (fromTs) msgs = msgs.filter((m) => m.timestamp >= fromTs);
        if (toTs) msgs = msgs.filter((m) => m.timestamp <= toTs);
        return msgs;
    }

    /**
     * List sessions.
     */
    listSessions(): Array<{ id: string; messageCount: number }> {
        return Array.from(this.recordings).map(([id, msgs]) => ({ id, messageCount: msgs.length }));
    }

    /**
     * Is recording?
     */
    isRecording(): boolean { return this.recording; }

    /** Count sessions */
    count(): number { return this.recordings.size; }
}
