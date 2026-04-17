/**
 * secrets/key-rotation.ts
 * Key rotation management with grace periods and audit trails.
 * Upgraded from placeholder to production-grade OpenClaw pattern.
 */

import { generateEncryptionKey } from './encryption.js';

export interface RotationKey {
    id: string;
    key: string;
    createdAt: number;
    active: boolean;
    retiredAt?: number;
}

export interface RotationEvent {
    type: 'created' | 'activated' | 'retired' | 'expired';
    keyId: string;
    timestamp: number;
}

const DEFAULT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const DEFAULT_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export class KeyRotation {
    private keys: RotationKey[] = [];
    private auditLog: RotationEvent[] = [];
    private maxAgeMs: number;
    private gracePeriodMs: number;

    constructor(opts?: { maxAgeMs?: number; gracePeriodMs?: number }) {
        this.maxAgeMs = opts?.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
        this.gracePeriodMs = opts?.gracePeriodMs ?? DEFAULT_GRACE_PERIOD_MS;
    }

    /**
     * Add a new key and activate it. Previous active key enters grace period.
     */
    add(key: string, id?: string): RotationKey {
        const keyId = id ?? `key_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const now = Date.now();

        // Retire current active key
        const currentActive = this.keys.find(k => k.active);
        if (currentActive) {
            currentActive.active = false;
            currentActive.retiredAt = now;
            this.logEvent('retired', currentActive.id);
        }

        const entry: RotationKey = { id: keyId, key, createdAt: now, active: true };
        this.keys.push(entry);
        this.logEvent('created', keyId);
        this.logEvent('activated', keyId);

        return entry;
    }

    /**
     * Generate and add a new random key.
     */
    rotate(): RotationKey {
        return this.add(generateEncryptionKey());
    }

    /**
     * Get the current active key.
     */
    getActive(): string | null {
        return this.keys.find(k => k.active)?.key ?? null;
    }

    /**
     * Get the active key ID.
     */
    getActiveId(): string | null {
        return this.keys.find(k => k.active)?.id ?? null;
    }

    /**
     * Get all keys that can be used for decryption (active + grace period).
     * During rotation, both old and new keys can decrypt data.
     */
    getDecryptionKeys(): string[] {
        const now = Date.now();
        return this.keys
            .filter(k => k.active || (k.retiredAt && now - k.retiredAt < this.gracePeriodMs))
            .map(k => k.key);
    }

    /**
     * Check if rotation is needed.
     */
    needsRotation(): boolean {
        const active = this.keys.find(k => k.active);
        if (!active) return true;
        return Date.now() - active.createdAt > this.maxAgeMs;
    }

    /**
     * Remove expired keys beyond the grace period.
     */
    purgeExpired(): number {
        const now = Date.now();
        const before = this.keys.length;
        this.keys = this.keys.filter(k => {
            if (k.active) return true;
            if (k.retiredAt && now - k.retiredAt > this.gracePeriodMs) {
                this.logEvent('expired', k.id);
                return false;
            }
            return true;
        });
        return before - this.keys.length;
    }

    /**
     * Get all keys (for serialization).
     */
    getAll(): ReadonlyArray<RotationKey> {
        return this.keys;
    }

    /**
     * Get audit log.
     */
    getAuditLog(): ReadonlyArray<RotationEvent> {
        return this.auditLog;
    }

    /**
     * Load keys from serialized state.
     */
    loadKeys(keys: RotationKey[]): void {
        this.keys = [...keys];
    }

    private logEvent(type: RotationEvent['type'], keyId: string): void {
        this.auditLog.push({ type, keyId, timestamp: Date.now() });
    }
}
