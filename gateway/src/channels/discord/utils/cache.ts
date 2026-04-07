/**
 * Discord Cache — In-memory cache for Discord objects (messages, users, guilds).
 */
export class DiscordCache<T> {
    private store = new Map<string, { value: T; expiresAt: number }>();
    private maxSize: number;
    private ttlMs: number;

    constructor(maxSize: number = 1000, ttlMs: number = 300_000) { this.maxSize = maxSize; this.ttlMs = ttlMs; }

    set(key: string, value: T): void {
        if (this.store.size >= this.maxSize) { const oldest = this.store.keys().next().value; if (oldest) this.store.delete(oldest); }
        this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    }

    get(key: string): T | undefined {
        const entry = this.store.get(key);
        if (!entry) return undefined;
        if (Date.now() > entry.expiresAt) { this.store.delete(key); return undefined; }
        return entry.value;
    }

    delete(key: string): boolean { return this.store.delete(key); }
    clear(): void { this.store.clear(); }
    get size(): number { return this.store.size; }
}