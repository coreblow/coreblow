/**
 * CoreBlow — Consent Manager
 *
 * Manages user consent for data processing, analytics,
 * and AI features. GDPR/privacy-compliant consent
 * tracking with granular categories.
 */

/** Consent category */
export interface ConsentCategory {
    id: string;
    name: string;
    description: string;
    required: boolean;
    defaultValue: boolean;
}

/** User consent record */
export interface UserConsent {
    userId: string;
    consents: Record<string, boolean>;
    updatedAt: number;
    ip?: string;
    version: number;
}

/**
 * CoreBlow Consent Manager
 */
export class ConsentManager {
    private categories = new Map<string, ConsentCategory>();
    private userConsents = new Map<string, UserConsent>();

    constructor() {
        // Default categories
        this.addCategory('essential', 'Essential', 'Required for service operation', true, true);
        this.addCategory('analytics', 'Analytics', 'Usage analytics and improvements', false, false);
        this.addCategory('ai-training', 'AI Training', 'Use conversations for model improvement', false, false);
        this.addCategory('personalization', 'Personalization', 'Personalized AI responses', false, true);
    }

    /**
     * Add a consent category.
     */
    addCategory(id: string, name: string, description: string, required: boolean, defaultValue: boolean): void {
        this.categories.set(id, { id, name, description, required, defaultValue });
    }

    /**
     * Set user consent.
     */
    setConsent(userId: string, categoryId: string, granted: boolean): boolean {
        const category = this.categories.get(categoryId);
        if (!category) return false;
        if (category.required && !granted) return false; // Can't refuse required

        let record = this.userConsents.get(userId);
        if (!record) {
            record = { userId, consents: this.getDefaults(), updatedAt: Date.now(), version: 1 };
            this.userConsents.set(userId, record);
        }

        record.consents[categoryId] = granted;
        record.updatedAt = Date.now();
        record.version++;
        return true;
    }

    /**
     * Set all consents at once.
     */
    setAllConsents(userId: string, consents: Record<string, boolean>): void {
        const merged = this.getDefaults();
        for (const [key, val] of Object.entries(consents)) {
            const cat = this.categories.get(key);
            if (cat && (!cat.required || val)) merged[key] = val;
        }
        const existing = this.userConsents.get(userId);
        this.userConsents.set(userId, {
            userId, consents: merged, updatedAt: Date.now(),
            version: (existing?.version ?? 0) + 1,
        });
    }

    /**
     * Check if user has consent for a category.
     */
    hasConsent(userId: string, categoryId: string): boolean {
        const record = this.userConsents.get(userId);
        if (!record) {
            const category = this.categories.get(categoryId);
            return category?.defaultValue ?? false;
        }
        return record.consents[categoryId] ?? false;
    }

    /**
     * Get user consents.
     */
    getUserConsents(userId: string): Record<string, boolean> {
        return this.userConsents.get(userId)?.consents ?? this.getDefaults();
    }

    /**
     * Withdraw all non-essential consents (right to withdraw).
     */
    withdrawAll(userId: string): void {
        const defaults = this.getDefaults();
        for (const [key, cat] of Array.from(this.categories)) {
            defaults[key] = cat.required ? true : false;
        }
        this.userConsents.set(userId, { userId, consents: defaults, updatedAt: Date.now(), version: (this.userConsents.get(userId)?.version ?? 0) + 1 });
    }

    /**
     * List categories.
     */
    listCategories(): ConsentCategory[] {
        return Array.from(this.categories.values());
    }

    /** Count users */
    count(): number { return this.userConsents.size; }

    // === Private ===

    private getDefaults(): Record<string, boolean> {
        const defaults: Record<string, boolean> = {};
        for (const [id, cat] of Array.from(this.categories)) defaults[id] = cat.defaultValue;
        return defaults;
    }
}
