/**
 * CoreBlow — Feature Flags
 *
 * Runtime feature flag management for gradual rollouts,
 * A/B testing, and kill switches. Supports user/channel
 * targeting and percentage-based rollouts.
 */

/** Feature flag */
export interface FeatureFlag {
    id: string;
    name: string;
    description?: string;
    enabled: boolean;
    /** Percentage rollout (0-100) */
    rolloutPercent?: number;
    /** Target specific users */
    targetUsers?: string[];
    /** Target specific channels */
    targetChannels?: string[];
    createdAt: number;
    updatedAt: number;
}

/** Flag evaluation context */
export interface FlagContext {
    userId?: string;
    channel?: string;
}

/**
 * CoreBlow Feature Flags
 */
export class FeatureFlags {
    private flags = new Map<string, FeatureFlag>();

    /**
     * Define a feature flag.
     */
    define(id: string, name: string, enabled: boolean = false, opts?: Partial<FeatureFlag>): void {
        this.flags.set(id, {
            id, name, enabled,
            description: opts?.description,
            rolloutPercent: opts?.rolloutPercent,
            targetUsers: opts?.targetUsers,
            targetChannels: opts?.targetChannels,
            createdAt: Date.now(), updatedAt: Date.now(),
        });
    }

    /**
     * Check if a flag is enabled for given context.
     */
    isEnabled(flagId: string, ctx?: FlagContext): boolean {
        const flag = this.flags.get(flagId);
        if (!flag) return false;
        if (!flag.enabled) return false;

        // User targeting
        if (flag.targetUsers && flag.targetUsers.length > 0) {
            if (!ctx?.userId || !flag.targetUsers.includes(ctx.userId)) return false;
        }

        // Channel targeting
        if (flag.targetChannels && flag.targetChannels.length > 0) {
            if (!ctx?.channel || !flag.targetChannels.includes(ctx.channel)) return false;
        }

        // Percentage rollout
        if (flag.rolloutPercent !== undefined && flag.rolloutPercent < 100) {
            if (!ctx?.userId) return flag.rolloutPercent > 50; // Default for anonymous
            const hash = this.hashString(`${flagId}:${ctx.userId}`);
            return (hash % 100) < flag.rolloutPercent;
        }

        return true;
    }

    /**
     * Toggle a flag.
     */
    toggle(flagId: string): boolean {
        const flag = this.flags.get(flagId);
        if (!flag) return false;
        flag.enabled = !flag.enabled;
        flag.updatedAt = Date.now();
        return true;
    }

    /**
     * Set enabled state.
     */
    setEnabled(flagId: string, enabled: boolean): boolean {
        const flag = this.flags.get(flagId);
        if (!flag) return false;
        flag.enabled = enabled;
        flag.updatedAt = Date.now();
        return true;
    }

    /**
     * Set rollout percentage.
     */
    setRollout(flagId: string, percent: number): boolean {
        const flag = this.flags.get(flagId);
        if (!flag) return false;
        flag.rolloutPercent = Math.max(0, Math.min(100, percent));
        flag.updatedAt = Date.now();
        return true;
    }

    /**
     * Get a flag.
     */
    get(flagId: string): FeatureFlag | null {
        return this.flags.get(flagId) ?? null;
    }

    /**
     * List all flags.
     */
    list(): Array<{ id: string; name: string; enabled: boolean; rollout?: number }> {
        return Array.from(this.flags.values()).map((f) => ({
            id: f.id, name: f.name, enabled: f.enabled, rollout: f.rolloutPercent,
        }));
    }

    /**
     * Delete a flag.
     */
    delete(flagId: string): boolean {
        return this.flags.delete(flagId);
    }

    /** Count */
    count(): number { return this.flags.size; }

    // === Private ===

    private hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
        }
        return Math.abs(hash);
    }
}
