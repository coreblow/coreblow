/**
 * CoreBlow — Tenant Config
 *
 * Per-tenant configuration overrides with inheritance
 * from default config. Supports feature toggles,
 * branding, and custom settings per tenant.
 */

/** Tenant config */
export interface TenantConfigEntry {
    tenantId: string;
    overrides: Record<string, unknown>;
    features: Record<string, boolean>;
    branding?: { name?: string; logo?: string; primaryColor?: string };
    updatedAt: number;
}

/**
 * CoreBlow Tenant Config
 */
export class TenantConfig {
    private configs = new Map<string, TenantConfigEntry>();
    private defaults: Record<string, unknown> = {};

    /**
     * Set global defaults.
     */
    setDefaults(defaults: Record<string, unknown>): void {
        this.defaults = defaults;
    }

    /**
     * Set tenant overrides.
     */
    set(tenantId: string, overrides: Record<string, unknown>): void {
        const existing = this.configs.get(tenantId);
        this.configs.set(tenantId, {
            tenantId,
            overrides: { ...existing?.overrides, ...overrides },
            features: existing?.features ?? {},
            branding: existing?.branding,
            updatedAt: Date.now(),
        });
    }

    /**
     * Get resolved config (defaults + overrides).
     */
    resolve(tenantId: string): Record<string, unknown> {
        const entry = this.configs.get(tenantId);
        return { ...this.defaults, ...entry?.overrides };
    }

    /**
     * Set a feature flag for a tenant.
     */
    setFeature(tenantId: string, feature: string, enabled: boolean): void {
        const entry = this.getOrCreate(tenantId);
        entry.features[feature] = enabled;
        entry.updatedAt = Date.now();
    }

    /**
     * Check if tenant has a feature.
     */
    hasFeature(tenantId: string, feature: string): boolean {
        const entry = this.configs.get(tenantId);
        return entry?.features[feature] ?? false;
    }

    /**
     * Set branding.
     */
    setBranding(tenantId: string, branding: TenantConfigEntry['branding']): void {
        const entry = this.getOrCreate(tenantId);
        entry.branding = { ...entry.branding, ...branding };
        entry.updatedAt = Date.now();
    }

    /**
     * Get branding.
     */
    getBranding(tenantId: string): TenantConfigEntry['branding'] | null {
        return this.configs.get(tenantId)?.branding ?? null;
    }

    /**
     * Get raw entry.
     */
    get(tenantId: string): TenantConfigEntry | null {
        return this.configs.get(tenantId) ?? null;
    }

    /** Count */
    count(): number { return this.configs.size; }

    // === Private ===
    private getOrCreate(tenantId: string): TenantConfigEntry {
        if (!this.configs.has(tenantId)) {
            this.configs.set(tenantId, { tenantId, overrides: {}, features: {}, updatedAt: Date.now() });
        }
        return this.configs.get(tenantId)!;
    }
}
