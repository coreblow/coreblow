/**
 * CoreBlow — Auth State Observation (CoreBlow Parity)
 *
 * Observable auth state changes and event emission.
 */

import type { AuthProfileFailureReason } from './types.js';

export type AuthStateEvent =
    | { type: 'profile_added'; profileId: string; provider: string }
    | { type: 'profile_removed'; profileId: string; provider: string }
    | { type: 'profile_updated'; profileId: string; provider: string }
    | { type: 'profile_failure'; profileId: string; provider: string; reason: AuthProfileFailureReason }
    | { type: 'profile_cooldown_start'; profileId: string; provider: string; durationMs: number }
    | { type: 'profile_cooldown_end'; profileId: string; provider: string }
    | { type: 'profile_disabled'; profileId: string; provider: string }
    | { type: 'profile_enabled'; profileId: string; provider: string }
    | { type: 'oauth_refreshed'; profileId: string; provider: string }
    | { type: 'store_loaded'; profileCount: number };

type AuthStateListener = (event: AuthStateEvent) => void;

const listeners = new Set<AuthStateListener>();

export function onAuthStateChange(listener: AuthStateListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function emitAuthStateEvent(event: AuthStateEvent): void {
    for (const listener of listeners) {
        try {
            listener(event);
        } catch {
            // Ignore listener errors
        }
    }
}

export function clearAuthStateListeners(): void {
    listeners.clear();
}

export function authStateListenerCount(): number {
    return listeners.size;
}
