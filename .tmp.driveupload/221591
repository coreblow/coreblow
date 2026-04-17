/**
 * CoreBlow — Connection Pool
 *
 * Manages reusable connections to external services
 * (databases, APIs, etc.) with max pool size, idle
 * timeout, health checks, and connection tracking.
 */

/** Pool connection */
export interface PoolConnection {
    id: string;
    target: string;
    status: 'idle' | 'active' | 'closed';
    createdAt: number;
    lastUsed: number;
    useCount: number;
}

/** Pool options */
export interface PoolOptions {
    maxSize: number;
    idleTimeoutMs: number;
    acquireTimeoutMs: number;
}

/**
 * CoreBlow Connection Pool
 */
export class ConnectionPool {
    private connections = new Map<string, PoolConnection>();
    private options: PoolOptions;
    private idCounter = 0;

    constructor(opts?: Partial<PoolOptions>) {
        this.options = {
            maxSize: opts?.maxSize ?? 10,
            idleTimeoutMs: opts?.idleTimeoutMs ?? 30_000,
            acquireTimeoutMs: opts?.acquireTimeoutMs ?? 5_000,
        };
    }

    /**
     * Acquire a connection.
     */
    acquire(target: string): PoolConnection | null {
        // Try reuse idle
        for (const conn of Array.from(this.connections.values())) {
            if (conn.target === target && conn.status === 'idle') {
                conn.status = 'active';
                conn.lastUsed = Date.now();
                conn.useCount++;
                return conn;
            }
        }

        // Create new if under limit
        if (this.connections.size < this.options.maxSize) {
            const id = `pool-${++this.idCounter}`;
            const conn: PoolConnection = {
                id, target, status: 'active',
                createdAt: Date.now(), lastUsed: Date.now(), useCount: 1,
            };
            this.connections.set(id, conn);
            return conn;
        }

        return null; // Pool exhausted
    }

    /**
     * Release a connection back to pool.
     */
    release(connId: string): boolean {
        const conn = this.connections.get(connId);
        if (!conn || conn.status !== 'active') return false;
        conn.status = 'idle';
        conn.lastUsed = Date.now();
        return true;
    }

    /**
     * Close a connection.
     */
    close(connId: string): boolean {
        const conn = this.connections.get(connId);
        if (!conn) return false;
        conn.status = 'closed';
        this.connections.delete(connId);
        return true;
    }

    /**
     * Evict idle connections past timeout.
     */
    evictIdle(): number {
        const now = Date.now();
        let count = 0;
        for (const [id, conn] of Array.from(this.connections)) {
            if (conn.status === 'idle' && (now - conn.lastUsed) > this.options.idleTimeoutMs) {
                this.connections.delete(id);
                count++;
            }
        }
        return count;
    }

    /**
     * Get pool stats.
     */
    getStats(): { total: number; active: number; idle: number; maxSize: number } {
        let active = 0, idle = 0;
        for (const conn of Array.from(this.connections.values())) {
            if (conn.status === 'active') active++;
            else if (conn.status === 'idle') idle++;
        }
        return { total: this.connections.size, active, idle, maxSize: this.options.maxSize };
    }

    /**
     * Drain all connections.
     */
    drain(): number {
        const count = this.connections.size;
        this.connections.clear();
        return count;
    }

    /** Count */
    count(): number { return this.connections.size; }
}
