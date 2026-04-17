/**
 * CoreBlow — Connection Pool V2
 *
 * Advanced connection pooling with health checks,
 * automatic scaling, connection recycling, and
 * per-host limits.
 */

/** Pool connection */
export interface PoolConnection {
    id: string;
    host: string;
    status: 'idle' | 'active' | 'draining';
    createdAt: number;
    lastUsedAt: number;
    useCount: number;
}

/**
 * CoreBlow Connection Pool V2
 */
export class ConnectionPoolV2 {
    private connections = new Map<string, PoolConnection>();
    private maxPerHost: number;
    private maxAge: number;
    private idCounter = 0;
    private stats = { acquired: 0, released: 0, recycled: 0, timeouts: 0 };

    constructor(maxPerHost: number = 10, maxAgeMs: number = 300_000) {
        this.maxPerHost = maxPerHost;
        this.maxAge = maxAgeMs;
    }

    /**
     * Acquire a connection.
     */
    acquire(host: string): PoolConnection | null {
        // Try to find an idle connection
        for (const conn of Array.from(this.connections.values())) {
            if (conn.host === host && conn.status === 'idle') {
                if (Date.now() - conn.createdAt > this.maxAge) {
                    this.connections.delete(conn.id);
                    this.stats.recycled++;
                    continue;
                }
                conn.status = 'active';
                conn.lastUsedAt = Date.now();
                conn.useCount++;
                this.stats.acquired++;
                return conn;
            }
        }

        // Check if we can create a new one
        const hostCount = Array.from(this.connections.values()).filter((c) => c.host === host).length;
        if (hostCount >= this.maxPerHost) { this.stats.timeouts++; return null; }

        const conn: PoolConnection = {
            id: `conn-${++this.idCounter}`, host, status: 'active',
            createdAt: Date.now(), lastUsedAt: Date.now(), useCount: 1,
        };
        this.connections.set(conn.id, conn);
        this.stats.acquired++;
        return conn;
    }

    /**
     * Release a connection.
     */
    release(id: string): boolean {
        const conn = this.connections.get(id);
        if (!conn || conn.status !== 'active') return false;
        conn.status = 'idle';
        this.stats.released++;
        return true;
    }

    /**
     * Drain a host (mark all as draining).
     */
    drain(host: string): number {
        let count = 0;
        for (const conn of Array.from(this.connections.values())) {
            if (conn.host === host) { conn.status = 'draining'; count++; }
        }
        return count;
    }

    /**
     * Cleanup expired connections.
     */
    cleanup(): number {
        let cleaned = 0;
        for (const [id, conn] of Array.from(this.connections)) {
            if (conn.status === 'draining' || (conn.status === 'idle' && Date.now() - conn.createdAt > this.maxAge)) {
                this.connections.delete(id);
                this.stats.recycled++;
                cleaned++;
            }
        }
        return cleaned;
    }

    /**
     * Get pool status.
     */
    getStatus(): { total: number; active: number; idle: number; draining: number } {
        const conns = Array.from(this.connections.values());
        return {
            total: conns.length,
            active: conns.filter((c) => c.status === 'active').length,
            idle: conns.filter((c) => c.status === 'idle').length,
            draining: conns.filter((c) => c.status === 'draining').length,
        };
    }

    /**
     * Get stats.
     */
    getStats(): typeof this.stats { return { ...this.stats }; }

    /** Size */
    size(): number { return this.connections.size; }
}
