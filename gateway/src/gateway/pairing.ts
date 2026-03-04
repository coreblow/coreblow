/**
 * src/gateway/pairing.ts
 * Device pairing — generate codes, validate, manage paired devices
 */

import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('pairing');

export interface PairedDevice {
    id: string;
    name: string;
    token: string;           // hashed device token
    platform?: string;       // 'ios' | 'android' | 'macos' | 'linux' | 'windows' | 'web'
    pairedAt: number;
    lastSeen: number;
    ip?: string;
}

interface PendingCode {
    code: string;
    expiresAt: number;
    deviceName?: string;
}

const CODE_TTL = 5 * 60 * 1000;  // 5 minutes
const CODE_LENGTH = 8;            // e.g. "ABCD-1234"

export class PairingManager {
    private devices: Map<string, PairedDevice> = new Map();
    private pendingCodes: Map<string, PendingCode> = new Map();
    private storePath: string;

    constructor(homeDir: string) {
        this.storePath = `${homeDir}/devices.json`;
        this.loadDevices();
    }

    /**
     * Generate a new pairing code (called from CLI or API)
     */
    generateCode(): { code: string; expiresAt: number; expiresIn: string } {
        // Clean expired codes
        this.cleanExpired();

        // Generate human-readable code: XXXX-XXXX
        const raw = randomBytes(4).toString('hex').toUpperCase();
        const code = `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
        const expiresAt = Date.now() + CODE_TTL;

        this.pendingCodes.set(code, { code, expiresAt });

        log.info({ code, expiresIn: '5m' }, 'Pairing code generated');

        return {
            code,
            expiresAt,
            expiresIn: '5 minutes',
        };
    }

    /**
     * Validate a pairing code and register the device
     */
    pair(code: string, deviceName: string, platform?: string, ip?: string): {
        success: boolean;
        deviceId?: string;
        token?: string;
        error?: string;
    } {
        this.cleanExpired();

        const pending = this.pendingCodes.get(code.toUpperCase());

        if (!pending) {
            log.warn({ code }, 'Invalid or expired pairing code');
            return { success: false, error: 'Invalid or expired pairing code' };
        }

        if (Date.now() > pending.expiresAt) {
            this.pendingCodes.delete(code);
            return { success: false, error: 'Pairing code expired' };
        }

        // Generate device token
        const rawToken = randomBytes(32).toString('hex');
        const tokenHash = createHash('sha256').update(rawToken).digest('hex');
        const deviceId = randomUUID();

        const device: PairedDevice = {
            id: deviceId,
            name: deviceName || 'Unknown Device',
            token: tokenHash,
            platform: platform || 'unknown',
            pairedAt: Date.now(),
            lastSeen: Date.now(),
            ip,
        };

        this.devices.set(deviceId, device);
        this.pendingCodes.delete(code);
        this.saveDevices();

        log.info({ deviceId, name: deviceName, platform }, 'Device paired successfully');

        return {
            success: true,
            deviceId,
            token: rawToken,  // return raw token once, stored as hash
        };
    }

    /**
     * Validate a device token (for authenticated requests)
     */
    validateToken(token: string): PairedDevice | null {
        const tokenHash = createHash('sha256').update(token).digest('hex');

        for (const device of this.devices.values()) {
            if (device.token === tokenHash) {
                device.lastSeen = Date.now();
                return device;
            }
        }
        return null;
    }

    /**
     * List all paired devices
     */
    listDevices(): Omit<PairedDevice, 'token'>[] {
        return Array.from(this.devices.values()).map(({ token, ...rest }) => rest);
    }

    /**
     * Revoke (unpair) a device
     */
    revoke(deviceId: string): boolean {
        const existed = this.devices.delete(deviceId);
        if (existed) {
            this.saveDevices();
            log.info({ deviceId }, 'Device revoked');
        }
        return existed;
    }

    /**
     * Revoke all devices
     */
    revokeAll(): number {
        const count = this.devices.size;
        this.devices.clear();
        this.saveDevices();
        log.info({ count }, 'All devices revoked');
        return count;
    }

    private cleanExpired() {
        const now = Date.now();
        for (const [code, pending] of this.pendingCodes) {
            if (now > pending.expiresAt) {
                this.pendingCodes.delete(code);
            }
        }
    }

    private loadDevices() {
        try {
            const fs = require('node:fs');
            if (fs.existsSync(this.storePath)) {
                const data = JSON.parse(fs.readFileSync(this.storePath, 'utf-8'));
                for (const d of data) {
                    this.devices.set(d.id, d);
                }
                log.info({ count: this.devices.size }, 'Paired devices loaded');
            }
        } catch {
            // No devices file yet
        }
    }

    private saveDevices() {
        try {
            const fs = require('node:fs');
            const data = Array.from(this.devices.values());
            fs.writeFileSync(this.storePath, JSON.stringify(data, null, 2));
        } catch (err: any) {
            log.error({ err: err.message }, 'Failed to save devices');
        }
    }
}
