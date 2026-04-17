/**
 * CoreBlow — Auth Profile Credential State (CoreBlow Parity)
 *
 * Evaluates whether a stored credential is eligible for use:
 * - api_key: must have key or keyRef
 * - token: must have token or tokenRef + not expired
 * - oauth: must have access or refresh token
 */

import type { AuthProfileCredential, SecretRef } from './types.js';

export type AuthCredentialReasonCode =
    | 'ok'
    | 'missing_credential'
    | 'invalid_expires'
    | 'expired'
    | 'unresolved_ref';

export type TokenExpiryState = 'missing' | 'valid' | 'expired' | 'invalid_expires';

export function resolveTokenExpiryState(expires: unknown, now = Date.now()): TokenExpiryState {
    if (expires === undefined) {
        return 'missing';
    }
    if (typeof expires !== 'number') {
        return 'invalid_expires';
    }
    if (!Number.isFinite(expires) || expires <= 0) {
        return 'invalid_expires';
    }
    return now >= expires ? 'expired' : 'valid';
}

function hasConfiguredSecretRef(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    const ref = value as SecretRef;
    return typeof ref.source === 'string' && typeof ref.key === 'string';
}

function hasConfiguredSecretString(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    return value.trim().length > 0;
}

export function evaluateStoredCredentialEligibility(params: {
    credential: AuthProfileCredential;
    now?: number;
}): { eligible: boolean; reasonCode: AuthCredentialReasonCode } {
    const now = params.now ?? Date.now();
    const credential = params.credential;

    if (credential.type === 'api_key') {
        const hasKey = hasConfiguredSecretString(credential.key);
        const hasKeyRef = hasConfiguredSecretRef(credential.keyRef);
        if (!hasKey && !hasKeyRef) {
            return { eligible: false, reasonCode: 'missing_credential' };
        }
        return { eligible: true, reasonCode: 'ok' };
    }

    if (credential.type === 'token') {
        const hasToken = hasConfiguredSecretString(credential.token);
        const hasTokenRef = hasConfiguredSecretRef(credential.tokenRef);
        if (!hasToken && !hasTokenRef) {
            return { eligible: false, reasonCode: 'missing_credential' };
        }
        const expiryState = resolveTokenExpiryState(credential.expires, now);
        if (expiryState === 'invalid_expires') {
            return { eligible: false, reasonCode: 'invalid_expires' };
        }
        if (expiryState === 'expired') {
            return { eligible: false, reasonCode: 'expired' };
        }
        return { eligible: true, reasonCode: 'ok' };
    }

    // OAuth
    if (
        !hasConfiguredSecretString(credential.access) &&
        !hasConfiguredSecretString(credential.refresh)
    ) {
        return { eligible: false, reasonCode: 'missing_credential' };
    }
    return { eligible: true, reasonCode: 'ok' };
}
