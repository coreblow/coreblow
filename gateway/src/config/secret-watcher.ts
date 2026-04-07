/**
 * CoreBlow — Secret Watcher
 *
 * Monitors secrets (API keys, tokens) for rotation, expiry,
 * and leakage detection. Provides rotation callbacks,
 * expiry alerts, and secret validation.
 */

import * as crypto from 'node:crypto';

/** Secret entry */
export interface SecretEntry {
    key: string;
    value: string;
    /** Hash of value (never expose raw) */
    hash: string;
    provider?: string;
    expiresAt?: number;
    rotatedAt: number;
    createdAt: number;
    rotationCount: number;
}

/** Rotation callback */
export type RotationCallback = (key: string, oldHash: string) => Promise<string | null>;

/** Watcher alert */
export interface SecretAlert {
    type: 'expired' | 'expiring-soon' | 'rotated' | 'leaked';
    key: string;
    message: string;
    timestamp: number;
}

/**
 * CoreBlow Secret Watcher
 */
export class SecretWatcher {
    private secrets = new Map<string, SecretEntry>();
    private rotationCallbacks = new Map<string, RotationCallback>();
    private alerts: SecretAlert[] = [];
    private maxAlerts = 200;

    /**
     * Register a secret.
     */
    register(key: string, value: string, provider?: string, expiresAt?: number): void {
        this.secrets.set(key, {
            key,
            value,
            hash: this.hashValue(value),
            provider,
            expiresAt,
            rotatedAt: Date.now(),
            createdAt: Date.now(),
            rotationCount: 0,
        });
    }

    /**
     * Get a secret value.
     */
    get(key: string): string | null {
        const entry = this.secrets.get(key);
        if (!entry) return null;
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.addAlert('expired', key, `Secret "${key}" has expired`);
            return null;
        }
        return entry.value;
    }

    /**
     * Rotate a secret.
     */
    rotate(key: string, newValue: string): boolean {
        const entry = this.secrets.get(key);
        if (!entry) return false;
        entry.value = newValue;
        entry.hash = this.hashValue(newValue);
        entry.rotatedAt = Date.now();
        entry.rotationCount++;
        this.addAlert('rotated', key, `Secret "${key}" rotated (count: ${entry.rotationCount})`);
        return true;
    }

    /**
     * Set rotation callback for auto-rotation.
     */
    onRotation(key: string, callback: RotationCallback): void {
        this.rotationCallbacks.set(key, callback);
    }

    /**
     * Check all secrets for expiry.
     */
    checkExpiry(warningMs: number = 24 * 60 * 60 * 1000): SecretAlert[] {
        const now = Date.now();
        const newAlerts: SecretAlert[] = [];

        for (const entry of Array.from(this.secrets.values())) {
            if (!entry.expiresAt) continue;
            if (now > entry.expiresAt) {
                const alert: SecretAlert = { type: 'expired', key: entry.key, message: `"${entry.key}" expired`, timestamp: now };
                newAlerts.push(alert);
                this.addAlert(alert.type, alert.key, alert.message);
            } else if (entry.expiresAt - now < warningMs) {
                const hoursLeft = Math.round((entry.expiresAt - now) / 3600000);
                const alert: SecretAlert = { type: 'expiring-soon', key: entry.key, message: `"${entry.key}" expires in ${hoursLeft}h`, timestamp: now };
                newAlerts.push(alert);
                this.addAlert(alert.type, alert.key, alert.message);
            }
        }
        return newAlerts;
    }

    /**
     * Scan text for leaked secrets.
     */
    scanForLeaks(text: string): SecretAlert[] {
        const leaks: SecretAlert[] = [];
        for (const entry of Array.from(this.secrets.values())) {
            if (text.includes(entry.value)) {
                const alert: SecretAlert = { type: 'leaked', key: entry.key, message: `Secret "${entry.key}" found in text!`, timestamp: Date.now() };
                leaks.push(alert);
                this.addAlert(alert.type, alert.key, alert.message);
            }
        }
        return leaks;
    }

    /**
     * Get masked value (shows only last 4 chars).
     */
    getMasked(key: string): string | null {
        const entry = this.secrets.get(key);
        if (!entry) return null;
        if (entry.value.length <= 4) return '****';
        return '****' + entry.value.slice(-4);
    }

    /**
     * Delete a secret.
     */
    delete(key: string): boolean {
        return this.secrets.delete(key);
    }

    /**
     * List secrets (masked).
     */
    list(): Array<{ key: string; provider?: string; masked: string; rotationCount: number }> {
        return Array.from(this.secrets.values()).map((e) => ({
            key: e.key,
            provider: e.provider,
            masked: e.value.length > 4 ? '****' + e.value.slice(-4) : '****',
            rotationCount: e.rotationCount,
        }));
    }

    /**
     * Get alerts.
     */
    getAlerts(limit?: number): SecretAlert[] {
        return this.alerts.slice(-(limit ?? 50));
    }

    /** Count */
    count(): number { return this.secrets.size; }

    // === Private ===

    private hashValue(value: string): string {
        return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
    }

    private addAlert(type: SecretAlert['type'], key: string, message: string): void {
        this.alerts.push({ type, key, message, timestamp: Date.now() });
        if (this.alerts.length > this.maxAlerts) this.alerts = this.alerts.slice(-this.maxAlerts);
    }
}
