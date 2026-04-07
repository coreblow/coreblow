/**
 * CoreBlow — SSE Handler
 *
 * Server-Sent Events handler for one-way real-time
 * streaming from server to client. Supports channels,
 * retry intervals, and connection management.
 */

/** SSE client */
export interface SSEClient {
    id: string;
    channel: string;
    userId?: string;
    connectedAt: number;
    eventCount: number;
    lastEventId?: string;
    status: 'active' | 'closed';
}

/** SSE event */
export interface SSEEvent {
    id?: string;
    event?: string;
    data: unknown;
    retry?: number;
}

/**
 * CoreBlow SSE Handler
 */
export class SSEHandler {
    private clients = new Map<string, SSEClient>();
    private channels = new Map<string, Set<string>>();
    private idCounter = 0;
    private eventCounter = 0;

    /**
     * Register a new SSE client.
     */
    subscribe(channel: string, userId?: string): SSEClient {
        const id = `sse-${++this.idCounter}`;
        const client: SSEClient = {
            id, channel, userId, connectedAt: Date.now(),
            eventCount: 0, status: 'active',
        };
        this.clients.set(id, client);
        if (!this.channels.has(channel)) this.channels.set(channel, new Set());
        this.channels.get(channel)!.add(id);
        return client;
    }

    /**
     * Unsubscribe a client.
     */
    unsubscribe(clientId: string): boolean {
        const client = this.clients.get(clientId);
        if (!client) return false;
        client.status = 'closed';
        this.channels.get(client.channel)?.delete(clientId);
        if (this.channels.get(client.channel)?.size === 0) this.channels.delete(client.channel);
        this.clients.delete(clientId);
        return true;
    }

    /**
     * Send event to a specific client.
     */
    sendTo(clientId: string, event: SSEEvent): boolean {
        const client = this.clients.get(clientId);
        if (!client || client.status !== 'active') return false;
        client.eventCount++;
        client.lastEventId = event.id ?? `evt-${++this.eventCounter}`;
        return true;
    }

    /**
     * Broadcast to a channel.
     */
    broadcast(channel: string, event: SSEEvent): number {
        const members = this.channels.get(channel);
        if (!members) return 0;
        let sent = 0;
        for (const clientId of Array.from(members)) {
            if (this.sendTo(clientId, event)) sent++;
        }
        return sent;
    }

    /**
     * Format SSE event string.
     */
    formatEvent(event: SSEEvent): string {
        const lines: string[] = [];
        if (event.id) lines.push(`id: ${event.id}`);
        if (event.event) lines.push(`event: ${event.event}`);
        if (event.retry) lines.push(`retry: ${event.retry}`);
        const data = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
        for (const line of data.split('\n')) lines.push(`data: ${line}`);
        lines.push('');
        return lines.join('\n') + '\n';
    }

    /**
     * Get client.
     */
    get(clientId: string): SSEClient | null {
        return this.clients.get(clientId) ?? null;
    }

    /**
     * List channels.
     */
    listChannels(): Array<{ name: string; subscribers: number }> {
        return Array.from(this.channels.entries()).map(([name, subs]) => ({ name, subscribers: subs.size }));
    }

    /**
     * Get stats.
     */
    getStats(): { clients: number; channels: number; totalEvents: number } {
        const totalEvents = Array.from(this.clients.values()).reduce((s, c) => s + c.eventCount, 0);
        return { clients: this.clients.size, channels: this.channels.size, totalEvents };
    }

    /** Count */
    count(): number { return this.clients.size; }
}
