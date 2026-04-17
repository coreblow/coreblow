/**
 * CoreBlow — API Key Manager
 *
 * Manages API key lifecycle: creation, validation,
 * rotation, rate limiting, and scope control.
 */

/** API key */
export interface ApiKey {
    id: string;
    key: string;
    name: string;
    owner: string;
    scopes: string[];
    rateLimit: number;
    usage: number;
    active: boolean;
    createdAt: number;
    expiresAt?: number;
    lastUsedAt?: number;
}

/**
 * CoreBlow API Key Manager
 */
export class ApiKeyManager {
    private keys = new Map<string, ApiKey>();
    private keyIndex = new Map<string, string>(); // key → id
    private idCounter = 0;
    private stats = { created: 0, validated: 0, rejected: 0, rotated: 0 };

    /**
     * Create an API key.
     */
    create(name: string, owner: string, scopes: string[] = ['*'], rateLimit: number = 1000, expiresInMs?: number): ApiKey {
        const id = `apikey-${++this.idCounter}`;
        const key = `cb_${this.generateKey()}`;
        const apiKey: ApiKey = {
            id, key, name, owner, scopes, rateLimit, usage: 0, active: true,
            createdAt: Date.now(), expiresAt: expiresInMs ? Date.now() + expiresInMs : undefined,
        };
        this.keys.set(id, apiKey);
        this.keyIndex.set(key, id);
        this.stats.created++;
        return apiKey;
    }

    /**
     * Validate an API key.
     */
    validate(key: string, requiredScope?: string): { valid: boolean; apiKey?: ApiKey; error?: string } {
        const id = this.keyIndex.get(key);
        if (!id) { this.stats.rejected++; return { valid: false, error: 'Key not found' }; }

        const apiKey = this.keys.get(id)!;
        if (!apiKey.active) { this.stats.rejected++; return { valid: false, error: 'Key inactive' }; }
        if (apiKey.expiresAt && Date.now() > apiKey.expiresAt) { this.stats.rejected++; return { valid: false, error: 'Key expired' }; }
        if (apiKey.usage >= apiKey.rateLimit) { this.stats.rejected++; return { valid: false, error: 'Rate limit exceeded' }; }
        if (requiredScope && !apiKey.scopes.includes('*') && !apiKey.scopes.includes(requiredScope)) {
            this.stats.rejected++; return { valid: false, error: 'Insufficient scope' };
        }

        apiKey.usage++;
        apiKey.lastUsedAt = Date.now();
        this.stats.validated++;
        return { valid: true, apiKey };
    }

    /**
     * Rotate a key (new key, same ID).
     */
    rotate(id: string): ApiKey | null {
        const apiKey = this.keys.get(id);
        if (!apiKey) return null;
        this.keyIndex.delete(apiKey.key);
        apiKey.key = `cb_${this.generateKey()}`;
        this.keyIndex.set(apiKey.key, id);
        this.stats.rotated++;
        return apiKey;
    }

    /**
     * Deactivate.
     */
    deactivate(id: string): boolean {
        const apiKey = this.keys.get(id);
        if (!apiKey) return false;
        apiKey.active = false;
        return true;
    }

    /**
     * List keys for an owner.
     */
    listByOwner(owner: string): ApiKey[] {
        return Array.from(this.keys.values()).filter((k) => k.owner === owner);
    }

    /**
     * Get stats.
     */
    getStats(): typeof this.stats { return { ...this.stats }; }

    /** Count */
    count(): number { return this.keys.size; }

    // === Private ===
    private generateKey(): string {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 32; i++) result += chars[Math.floor(Math.random() * chars.length)];
        return result;
    }
}
