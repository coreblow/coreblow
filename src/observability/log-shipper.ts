/**
 * CoreBlow — Log Shipper
 *
 * Buffers and ships structured logs to configurable
 * destinations. Supports batch shipping, formatting,
 * and log levels.
 */

/** Log entry */
export interface LogEntry {
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
    message: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
    source?: string;
}

/** Ship destination */
export interface LogDestination {
    name: string;
    handler: (entries: LogEntry[]) => Promise<void>;
    minLevel: LogEntry['level'];
    enabled: boolean;
}

/**
 * CoreBlow Log Shipper
 */
export class LogShipper {
    private buffer: LogEntry[] = [];
    private destinations: LogDestination[] = [];
    private maxBuffer = 1000;
    private levelOrder = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 };
    private shipCount = 0;

    /**
     * Add a destination.
     */
    addDestination(name: string, handler: LogDestination['handler'], minLevel: LogEntry['level'] = 'info'): void {
        this.destinations.push({ name, handler, minLevel, enabled: true });
    }

    /**
     * Log a message.
     */
    log(level: LogEntry['level'], message: string, metadata?: Record<string, unknown>, source?: string): void {
        this.buffer.push({ level, message, timestamp: Date.now(), metadata, source });
        if (this.buffer.length >= this.maxBuffer) this.flush();
    }

    /**
     * Convenience methods.
     */
    debug(msg: string, meta?: Record<string, unknown>): void { this.log('debug', msg, meta); }
    info(msg: string, meta?: Record<string, unknown>): void { this.log('info', msg, meta); }
    warn(msg: string, meta?: Record<string, unknown>): void { this.log('warn', msg, meta); }
    error(msg: string, meta?: Record<string, unknown>): void { this.log('error', msg, meta); }

    /**
     * Flush buffer to destinations.
     */
    async flush(): Promise<number> {
        if (this.buffer.length === 0) return 0;
        const entries = [...this.buffer];
        this.buffer = [];

        for (const dest of this.destinations) {
            if (!dest.enabled) continue;
            const filtered = entries.filter((e) => this.levelOrder[e.level] >= this.levelOrder[dest.minLevel]);
            if (filtered.length > 0) {
                try { await dest.handler(filtered); } catch { /* silently ignore */ }
            }
        }

        this.shipCount += entries.length;
        return entries.length;
    }

    /**
     * Get buffer size.
     */
    getBufferSize(): number { return this.buffer.length; }

    /**
     * Get ship count.
     */
    getShipCount(): number { return this.shipCount; }

    /**
     * List destinations.
     */
    list(): Array<{ name: string; minLevel: string; enabled: boolean }> {
        return this.destinations.map((d) => ({ name: d.name, minLevel: d.minLevel, enabled: d.enabled }));
    }

    /** Count destinations */
    count(): number { return this.destinations.length; }
}
