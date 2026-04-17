/**
 * CoreBlow — Auth Profile Session Override (CoreBlow Parity)
 *
 * Per-session auth profile overrides that let you use different
 * credentials for different sessions without changing global config.
 */

import type { AuthProfileCredential, AuthProfileStore } from './types.js';

// ─── Types ──────────────────────────────────────────────────────

export interface SessionAuthOverride {
    sessionKey: string;
    provider: string;
    profileId: string;
    credential?: AuthProfileCredential;
    expiresAt?: number;
    createdAt: number;
}

// ─── Runtime Override Registry ──────────────────────────────────

const sessionOverrides = new Map<string, Map<string, SessionAuthOverride>>();

/**
 * Set a per-session auth profile override.
 */
export function setSessionAuthOverride(params: {
    sessionKey: string;
    provider: string;
    profileId: string;
    credential?: AuthProfileCredential;
    durationMs?: number;
}): SessionAuthOverride {
    const { sessionKey, provider, profileId, credential, durationMs } = params;
    const providerKey = provider.toLowerCase();

    const override: SessionAuthOverride = {
        sessionKey,
        provider: providerKey,
        profileId,
        credential,
        createdAt: Date.now(),
        expiresAt: durationMs ? Date.now() + durationMs : undefined,
    };

    let sessionMap = sessionOverrides.get(sessionKey);
    if (!sessionMap) {
        sessionMap = new Map();
        sessionOverrides.set(sessionKey, sessionMap);
    }
    sessionMap.set(providerKey, override);

    return override;
}

/**
 * Get the active override for a session + provider.
 */
export function getSessionAuthOverride(
    sessionKey: string,
    provider: string,
    now = Date.now(),
): SessionAuthOverride | null {
    const sessionMap = sessionOverrides.get(sessionKey);
    if (!sessionMap) return null;

    const providerKey = provider.toLowerCase();
    const override = sessionMap.get(providerKey);
    if (!override) return null;

    // Check expiry
    if (override.expiresAt && override.expiresAt <= now) {
        sessionMap.delete(providerKey);
        if (sessionMap.size === 0) sessionOverrides.delete(sessionKey);
        return null;
    }

    return override;
}

/**
 * Clear override for a session + provider.
 */
export function clearSessionAuthOverride(sessionKey: string, provider?: string): void {
    if (!provider) {
        sessionOverrides.delete(sessionKey);
        return;
    }

    const sessionMap = sessionOverrides.get(sessionKey);
    if (!sessionMap) return;
    sessionMap.delete(provider.toLowerCase());
    if (sessionMap.size === 0) sessionOverrides.delete(sessionKey);
}

/**
 * List all overrides for a session.
 */
export function listSessionAuthOverrides(sessionKey: string): SessionAuthOverride[] {
    const sessionMap = sessionOverrides.get(sessionKey);
    if (!sessionMap) return [];
    return Array.from(sessionMap.values());
}

/**
 * Apply session override to profile resolution.
 * If an override exists, it replaces the normal profile selection.
 */
export function resolveEffectiveProfile(params: {
    sessionKey: string;
    provider: string;
    store: AuthProfileStore;
    fallback: () => { profileId: string; credential: AuthProfileCredential } | null;
    now?: number;
}): { profileId: string; credential: AuthProfileCredential; overridden: boolean } | null {
    const now = params.now ?? Date.now();
    const override = getSessionAuthOverride(params.sessionKey, params.provider, now);

    if (override) {
        // Use override credential if provided, else lookup from store
        const credential = override.credential ?? params.store.profiles[override.profileId];
        if (credential) {
            return { profileId: override.profileId, credential, overridden: true };
        }
    }

    const resolved = params.fallback();
    if (!resolved) return null;
    return { ...resolved, overridden: false };
}

// ─── Cleanup ────────────────────────────────────────────────────

/**
 * Prune expired overrides.
 */
export function pruneExpiredOverrides(now = Date.now()): number {
    let pruned = 0;
    for (const [sessionKey, sessionMap] of sessionOverrides.entries()) {
        for (const [provider, override] of sessionMap.entries()) {
            if (override.expiresAt && override.expiresAt <= now) {
                sessionMap.delete(provider);
                pruned++;
            }
        }
        if (sessionMap.size === 0) sessionOverrides.delete(sessionKey);
    }
    return pruned;
}

/**
 * Get total count of active overrides.
 */
export function countActiveOverrides(): number {
    let count = 0;
    for (const sessionMap of sessionOverrides.values()) {
        count += sessionMap.size;
    }
    return count;
}

/**
 * Reset for testing.
 */
export function resetSessionOverridesForTests(): void {
    sessionOverrides.clear();
}
