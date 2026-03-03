/**
 * gateway/device-identity.ts — Ed25519 Device Identity Verification
 *
 * Verifies device identity signatures using Ed25519 public keys.
 * Devices sign their connect params (deviceId, clientId, role, scopes, nonce)
 * to prove they hold the private key corresponding to their registered public key.
 *
 * Ported from CoreBlow reference src/gateway/device-auth.ts (55 LOC) + signature
 * verification logic from connection auth flow.
 */

import { createVerify, KeyObject, createPublicKey } from 'node:crypto';
import { createChildLogger } from '../utils/logger.js';
import {
    buildDeviceAuthPayload,
    buildDeviceAuthPayloadV3,
    type DeviceAuthPayloadParams,
    type DeviceAuthPayloadV3Params,
} from './device-auth.js';
import type { ConnectParams } from './protocol/index.js';

const log = createChildLogger('device-identity');

// ─── Types ──────────────────────────────────────────────────────────

export interface DeviceIdentity {
    deviceId: string;
    publicKey: string;  // PEM or base64 Ed25519
    registeredAt: number;
    label?: string;
    lastSeenAt?: number;
}

export interface DeviceVerifyResult {
    verified: boolean;
    deviceId?: string;
    reason?: string;
}

// ─── Signature Verification ─────────────────────────────────────────

/**
 * Verify a device's Ed25519 signature on connect params.
 *
 * The device builds a payload string from its connect params, signs it
 * with its Ed25519 private key, and sends the signature + publicKey in
 * the connect frame. We verify using the stored public key.
 */
export function verifyDeviceSignature(params: {
    device: NonNullable<ConnectParams['device']>;
    client: NonNullable<ConnectParams['client']>;
    connectParams: ConnectParams;
    storedIdentities: DeviceIdentity[];
}): DeviceVerifyResult {
    const { device, client, connectParams, storedIdentities } = params;

    if (!device.id || !device.publicKey || !device.signature) {
        return { verified: false, reason: 'missing device identity fields (id, publicKey, signature)' };
    }

    // Find stored identity by deviceId
    const storedDevice = storedIdentities.find((d) => d.deviceId === device.id);
    if (!storedDevice) {
        return { verified: false, deviceId: device.id, reason: 'device not registered' };
    }

    // Verify public key matches stored
    if (storedDevice.publicKey !== device.publicKey) {
        return { verified: false, deviceId: device.id, reason: 'public key mismatch' };
    }

    // Check signature freshness (max 5 minutes)
    const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000;
    const signedAt = device.signedAt ?? 0;
    if (Date.now() - signedAt > MAX_SIGNATURE_AGE_MS) {
        return { verified: false, deviceId: device.id, reason: 'signature expired' };
    }

    // Build the payload that was signed
    const payloadParams: DeviceAuthPayloadV3Params = {
        deviceId: device.id,
        clientId: client.id,
        clientMode: client.mode ?? 'ui',
        role: connectParams.role ?? 'operator',
        scopes: connectParams.scopes ?? [],
        signedAtMs: signedAt,
        token: connectParams.auth?.token ?? null,
        nonce: device.nonce ?? '',
        platform: client.platform,
        deviceFamily: client.deviceFamily,
    };

    const payloadV3 = buildDeviceAuthPayloadV3(payloadParams);
    const payloadV2 = buildDeviceAuthPayload(payloadParams);

    // Try v3 first, fallback to v2
    if (verifyEd25519(payloadV3, device.signature, device.publicKey)) {
        log.debug({ deviceId: device.id }, 'Device signature verified (v3)');
        return { verified: true, deviceId: device.id };
    }

    if (verifyEd25519(payloadV2, device.signature, device.publicKey)) {
        log.debug({ deviceId: device.id }, 'Device signature verified (v2)');
        return { verified: true, deviceId: device.id };
    }

    return { verified: false, deviceId: device.id, reason: 'signature verification failed' };
}

// ─── Ed25519 Crypto ─────────────────────────────────────────────────

/**
 * Verify an Ed25519 signature.
 * Accepts base64-encoded signature and PEM or base64 public key.
 */
function verifyEd25519(payload: string, signatureBase64: string, publicKeyStr: string): boolean {
    try {
        let pubKey: KeyObject;

        if (publicKeyStr.startsWith('-----BEGIN')) {
            // PEM format
            pubKey = createPublicKey(publicKeyStr);
        } else {
            // Raw base64 — convert to PEM
            pubKey = createPublicKey({
                key: Buffer.from(publicKeyStr, 'base64'),
                format: 'der',
                type: 'spki',
            });
        }

        const signatureBuffer = Buffer.from(signatureBase64, 'base64');
        const payloadBuffer = Buffer.from(payload, 'utf8');

        // Ed25519 uses verify with null algorithm
        const verify = createVerify('Ed25519' as string);
        verify.update(payloadBuffer);
        verify.end();

        return verify.verify(pubKey, signatureBuffer);
    } catch (err) {
        log.debug({ err }, 'Ed25519 verification error');
        return false;
    }
}

// ─── Device Registration ────────────────────────────────────────────

/**
 * Register a new device identity (in-memory for now).
 * In production, this would write to persistent storage.
 */
export function createDeviceIdentity(deviceId: string, publicKey: string, label?: string): DeviceIdentity {
    return {
        deviceId,
        publicKey,
        registeredAt: Date.now(),
        label,
    };
}

/**
 * Generate a fresh connect challenge nonce.
 */
export function generateConnectNonce(): string {
    const { randomBytes } = require('node:crypto');
    return randomBytes(32).toString('hex');
}
