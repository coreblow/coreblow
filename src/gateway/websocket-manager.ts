/**
 * CoreBlow — WebSocket Manager
 *
 * Manages WebSocket connections for real-time bidirectional
 * communication. Supports rooms, broadcasting, heartbeat,
 * and connection lifecycle tracking.
 */

/** WS connection */
export interface WSConnection {
    id: string;
    userId?: string;
    rooms: Set<string>;
    connectedAt: number;
    lastPing: number;
    metadata?: Record<string, unknown>;
    status: 'open' | 'closing' | 'closed';
    messageCount: number;
}

/** WS message */
export interface WSMessage {
    type: string;
    data: unknown;
    from?: string;
    room?: string;
    timestamp: number;
}

/**
 * CoreBlow WebSocket Manager
 */
export class WebSocketManager {
    private connections = new Map<string, WSConnection>();
    private rooms = new Map<string, Set<string>>();
    private messageLog: WSMessage[] = [];
    private maxLog = 500;
    private idCounter = 0;

    /**
     * Register a new connection.
     */
    connect(userId?: string): WSConnection {
        const id = `ws-${++this.idCounter}`;
        const conn: WSConnection = {
            id, userId, rooms: new Set(),
            connectedAt: Date.now(), lastPing: Date.now(),
            status: 'open', messageCount: 0,
        };
        this.connections.set(id, conn);
        return conn;
    }

    /**
     * Disconnect.
     */
    disconnect(connId: string): boolean {
        const conn = this.connections.get(connId);
        if (!conn) return false;
        conn.status = 'closed';
        for (const room of Array.from(conn.rooms)) this.leaveRoom(connId, room);
        this.connections.delete(connId);
        return true;
    }

    /**
     * Join a room.
     */
    joinRoom(connId: string, room: string): boolean {
        const conn = this.connections.get(connId);
        if (!conn || conn.status !== 'open') return false;
        conn.rooms.add(room);
        if (!this.rooms.has(room)) this.rooms.set(room, new Set());
        this.rooms.get(room)!.add(connId);
        return true;
    }

    /**
     * Leave a room.
     */
    leaveRoom(connId: string, room: string): boolean {
        const conn = this.connections.get(connId);
        if (!conn) return false;
        conn.rooms.delete(room);
        this.rooms.get(room)?.delete(connId);
        if (this.rooms.get(room)?.size === 0) this.rooms.delete(room);
        return true;
    }

    /**
     * Send to a specific connection.
     */
    send(connId: string, type: string, data: unknown): boolean {
        const conn = this.connections.get(connId);
        if (!conn || conn.status !== 'open') return false;
        conn.messageCount++;
        this.logMessage({ type, data, from: 'server', timestamp: Date.now() });
        return true;
    }

    /**
     * Broadcast to a room.
     */
    broadcast(room: string, type: string, data: unknown, excludeId?: string): number {
        const members = this.rooms.get(room);
        if (!members) return 0;
        let sent = 0;
        for (const connId of Array.from(members)) {
            if (connId === excludeId) continue;
            if (this.send(connId, type, data)) sent++;
        }
        return sent;
    }

    /**
     * Broadcast to all connections.
     */
    broadcastAll(type: string, data: unknown): number {
        let sent = 0;
        for (const connId of Array.from(this.connections.keys())) {
            if (this.send(connId, type, data)) sent++;
        }
        return sent;
    }

    /**
     * Get connection.
     */
    get(connId: string): WSConnection | null {
        return this.connections.get(connId) ?? null;
    }

    /**
     * Get room members.
     */
    getRoomMembers(room: string): string[] {
        return Array.from(this.rooms.get(room) ?? []);
    }

    /**
     * List rooms.
     */
    listRooms(): Array<{ name: string; members: number }> {
        return Array.from(this.rooms.entries()).map(([name, members]) => ({ name, members: members.size }));
    }

    /**
     * Get stats.
     */
    getStats(): { connections: number; rooms: number; totalMessages: number } {
        const totalMessages = Array.from(this.connections.values()).reduce((s, c) => s + c.messageCount, 0);
        return { connections: this.connections.size, rooms: this.rooms.size, totalMessages };
    }

    /** Count */
    count(): number { return this.connections.size; }

    // === Private ===
    private logMessage(msg: WSMessage): void {
        this.messageLog.push(msg);
        if (this.messageLog.length > this.maxLog) this.messageLog = this.messageLog.slice(-this.maxLog);
    }
}
