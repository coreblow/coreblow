/**
 * CoreBlow — Config Hot Reload
 *
 * Watches configuration changes and applies them
 * without restart. Supports change listeners,
 * validation, and rollback on error.
 */

/** Config snapshot */
export interface ConfigSnapshot {
    version: number;
    data: Record<string, unknown>;
    timestamp: number;
}

/**
 * CoreBlow Config Hot Reload
 */
export class ConfigHotReload {
    private current: ConfigSnapshot;
    private history: ConfigSnapshot[] = [];
    private listeners: Array<{ key: string | null; fn: (key: string, value: unknown, old: unknown) => void }> = [];
    private validator?: (config: Record<string, unknown>) => boolean;
    private version = 0;

    constructor(initial: Record<string, unknown> = {}) {
        this.current = { version: ++this.version, data: { ...initial }, timestamp: Date.now() };
    }

    /**
     * Set a validator.
     */
    setValidator(fn: (config: Record<string, unknown>) => boolean): void { this.validator = fn; }

    /**
     * Update a config value.
     */
    set(key: string, value: unknown): { success: boolean; error?: string } {
        const oldValue = this.current.data[key];
        const newData = { ...this.current.data, [key]: value };

        if (this.validator && !this.validator(newData)) {
            return { success: false, error: 'Validation failed' };
        }

        this.history.push({ ...this.current });
        this.current = { version: ++this.version, data: newData, timestamp: Date.now() };

        for (const listener of this.listeners) {
            if (listener.key === null || listener.key === key) {
                listener.fn(key, value, oldValue);
            }
        }

        return { success: true };
    }

    /**
     * Bulk update.
     */
    setMany(updates: Record<string, unknown>): { success: boolean; error?: string } {
        const newData = { ...this.current.data, ...updates };
        if (this.validator && !this.validator(newData)) {
            return { success: false, error: 'Validation failed' };
        }

        this.history.push({ ...this.current });
        const oldData = this.current.data;
        this.current = { version: ++this.version, data: newData, timestamp: Date.now() };

        for (const [key, value] of Object.entries(updates)) {
            for (const listener of this.listeners) {
                if (listener.key === null || listener.key === key) {
                    listener.fn(key, value, oldData[key]);
                }
            }
        }

        return { success: true };
    }

    /**
     * Get a config value.
     */
    get<T = unknown>(key: string): T | undefined { return this.current.data[key] as T | undefined; }

    /**
     * Get all config.
     */
    getAll(): Record<string, unknown> { return { ...this.current.data }; }

    /**
     * Listen for changes.
     */
    onChange(fn: (key: string, value: unknown, old: unknown) => void, key?: string): void {
        this.listeners.push({ key: key ?? null, fn });
    }

    /**
     * Rollback to previous version.
     */
    rollback(): boolean {
        if (this.history.length === 0) return false;
        this.current = this.history.pop()!;
        return true;
    }

    /**
     * Get version.
     */
    getVersion(): number { return this.current.version; }

    /**
     * Get history.
     */
    getHistory(): ConfigSnapshot[] { return [...this.history]; }
}
