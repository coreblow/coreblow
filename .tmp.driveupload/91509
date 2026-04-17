/**
 * agents/auth-profiles.ts
 * Auth profile management — per-provider credential rotation.
 * Ported from OpenClaw src/agents/auth-profiles.ts.
 */

export type AuthProfileStatus = 'active' | 'cooldown' | 'disabled' | 'expired';

export interface AuthProfile {
    id: string;
    provider: string;
    label?: string;
    priority: number;
    status: AuthProfileStatus;
    cooldownUntil?: number;
    lastUsedAt?: number;
    usageCount: number;
    errorCount: number;
    metadata?: Record<string, unknown>;
}

export interface AuthProfileStore {
    version: 1;
    profiles: AuthProfile[];
}

/**
 * Auth profile manager — handles rotation, cooldown, and selection.
 */
export class AuthProfileManager {
    private profiles: AuthProfile[] = [];

    constructor(initial?: AuthProfile[]) {
        if (initial) this.profiles = [...initial];
    }

    addProfile(profile: Omit<AuthProfile, 'usageCount' | 'errorCount' | 'status'>): AuthProfile {
        const full: AuthProfile = { ...profile, usageCount: 0, errorCount: 0, status: 'active' };
        this.profiles.push(full);
        return full;
    }

    /**
     * Select best available profile for a provider.
     */
    selectProfile(provider: string): AuthProfile | null {
        const now = Date.now();
        const available = this.profiles
            .filter((p) => p.provider === provider && p.status === 'active')
            .filter((p) => !p.cooldownUntil || p.cooldownUntil < now)
            .sort((a, b) => a.priority - b.priority || a.usageCount - b.usageCount);
        return available[0] ?? null;
    }

    /**
     * Record successful use of a profile.
     */
    recordSuccess(profileId: string): void {
        const p = this.profiles.find((x) => x.id === profileId);
        if (p) { p.usageCount++; p.lastUsedAt = Date.now(); p.errorCount = 0; }
    }

    /**
     * Record failure and potentially enter cooldown.
     */
    recordFailure(profileId: string, cooldownMs?: number): void {
        const p = this.profiles.find((x) => x.id === profileId);
        if (!p) return;
        p.errorCount++;
        p.lastUsedAt = Date.now();
        if (cooldownMs && cooldownMs > 0) {
            p.cooldownUntil = Date.now() + cooldownMs;
            p.status = 'cooldown';
        }
        if (p.errorCount >= 5) p.status = 'disabled';
    }

    /**
     * Restore a disabled/cooldown profile.
     */
    restore(profileId: string): boolean {
        const p = this.profiles.find((x) => x.id === profileId);
        if (!p) return false;
        p.status = 'active';
        p.cooldownUntil = undefined;
        p.errorCount = 0;
        return true;
    }

    /**
     * List profiles for a provider.
     */
    listForProvider(provider: string): AuthProfile[] {
        return this.profiles.filter((p) => p.provider === provider);
    }

    /**
     * List all profiles.
     */
    listAll(): AuthProfile[] { return [...this.profiles]; }

    /**
     * Remove a profile.
     */
    remove(profileId: string): boolean {
        const idx = this.profiles.findIndex((p) => p.id === profileId);
        if (idx < 0) return false;
        this.profiles.splice(idx, 1);
        return true;
    }

    /**
     * Resolve order for fallback.
     */
    resolveOrder(provider: string): AuthProfile[] {
        const now = Date.now();
        return this.profiles
            .filter((p) => p.provider === provider && (p.status === 'active' || (p.status === 'cooldown' && p.cooldownUntil && p.cooldownUntil < now)))
            .sort((a, b) => a.priority - b.priority);
    }

    /**
     * Prune expired cooldowns back to active.
     */
    pruneExpiredCooldowns(): number {
        const now = Date.now();
        let count = 0;
        for (const p of this.profiles) {
            if (p.status === 'cooldown' && p.cooldownUntil && p.cooldownUntil < now) {
                p.status = 'active';
                p.cooldownUntil = undefined;
                count++;
            }
        }
        return count;
    }

    toStore(): AuthProfileStore {
        return { version: 1, profiles: this.profiles };
    }

    static fromStore(store: AuthProfileStore): AuthProfileManager {
        return new AuthProfileManager(store.profiles);
    }
}
