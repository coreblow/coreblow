/**
 * gateway/protocol/connect-schema.ts — Connect Params Validator
 *
 * Validates the `connect` method params from WebSocket clients.
 * Uses the existing GATEWAY_CLIENT_IDS and GATEWAY_CLIENT_MODES enums
 * for strict validation (replaces Ajv in CoreBlow).
 */

import {
    GATEWAY_CLIENT_IDS,
    GATEWAY_CLIENT_MODES,
    type GatewayClientId,
    type GatewayClientMode,
} from './client-info.js';
import type { ConnectParams } from './index.js';

// ─── Enum Sets ──────────────────────────────────────────────────────

const VALID_CLIENT_IDS = new Set<string>(Object.values(GATEWAY_CLIENT_IDS));
const VALID_CLIENT_MODES = new Set<string>(Object.values(GATEWAY_CLIENT_MODES));

// ─── Validation ─────────────────────────────────────────────────────

export interface ConnectValidationError {
    path: string;
    message: string;
    expected?: string[];
}

export interface ConnectValidationResult {
    valid: boolean;
    errors: ConnectValidationError[];
}

/**
 * Validate ConnectParams from a WebSocket connect frame.
 * Checks required fields, enum constraints, and type correctness.
 */
export function validateConnectParams(params: unknown): ConnectValidationResult {
    const errors: ConnectValidationError[] = [];

    if (!params || typeof params !== 'object' || Array.isArray(params)) {
        return { valid: false, errors: [{ path: '/', message: 'params must be an object' }] };
    }

    const p = params as Record<string, unknown>;

    // client (required)
    if (!p.client || typeof p.client !== 'object') {
        errors.push({ path: '/client', message: 'client is required and must be an object' });
    } else {
        const client = p.client as Record<string, unknown>;

        // client.id (required, enum)
        if (typeof client.id !== 'string' || !client.id.trim()) {
            errors.push({
                path: '/client/id',
                message: 'client.id is required',
                expected: [...VALID_CLIENT_IDS],
            });
        } else if (!VALID_CLIENT_IDS.has(client.id)) {
            errors.push({
                path: '/client/id',
                message: `invalid client.id: "${client.id}"`,
                expected: [...VALID_CLIENT_IDS],
            });
        }

        // client.mode (optional but validated if present)
        if (client.mode !== undefined) {
            if (typeof client.mode !== 'string') {
                errors.push({ path: '/client/mode', message: 'client.mode must be a string' });
            } else if (!VALID_CLIENT_MODES.has(client.mode)) {
                errors.push({
                    path: '/client/mode',
                    message: `invalid client.mode: "${client.mode}"`,
                    expected: [...VALID_CLIENT_MODES],
                });
            }
        }
    }

    // role (optional, string)
    if (p.role !== undefined && typeof p.role !== 'string') {
        errors.push({ path: '/role', message: 'role must be a string' });
    }

    // scopes (optional, string[])
    if (p.scopes !== undefined) {
        if (!Array.isArray(p.scopes)) {
            errors.push({ path: '/scopes', message: 'scopes must be an array of strings' });
        } else if (p.scopes.some((s: unknown) => typeof s !== 'string')) {
            errors.push({ path: '/scopes', message: 'each scope must be a string' });
        }
    }

    // auth (optional, object)
    if (p.auth !== undefined && (typeof p.auth !== 'object' || Array.isArray(p.auth))) {
        errors.push({ path: '/auth', message: 'auth must be an object' });
    }

    // device (optional, object with id)
    if (p.device !== undefined) {
        if (typeof p.device !== 'object' || Array.isArray(p.device)) {
            errors.push({ path: '/device', message: 'device must be an object' });
        } else {
            const device = p.device as Record<string, unknown>;
            if (typeof device.id !== 'string' || !device.id.trim()) {
                errors.push({ path: '/device/id', message: 'device.id is required when device is provided' });
            }
        }
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Format validation errors for logging/error response.
 */
export function formatConnectValidationErrors(errors: ConnectValidationError[]): string {
    return errors
        .map((e) => `at ${e.path}: ${e.message}`)
        .join('; ');
}
