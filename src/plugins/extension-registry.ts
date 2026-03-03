/**
 * CoreBlow — Extension Registry
 *
 * Manages loadable extensions that add capabilities to the runtime.
 * Extensions can provide tools, channels, providers, or middleware.
 */

/** Extension type */
export type ExtensionType = 'tool' | 'channel' | 'provider' | 'middleware' | 'skill' | 'other';

/** Extension definition */
export interface Extension {
    id: string;
    name: string;
    type: ExtensionType;
    version: string;
    description?: string;
    author?: string;
    config?: Record<string, unknown>;
    setup?: (config: Record<string, unknown>) => Promise<void>;
    teardown?: () => Promise<void>;
    status: 'registered' | 'active' | 'inactive' | 'error';
    error?: string;
    registeredAt: number;
}

/**
 * CoreBlow Extension Registry
 */
export class ExtensionRegistry {
    private extensions = new Map<string, Extension>();

    /**
     * Register an extension.
     */
    register(ext: Omit<Extension, 'status' | 'registeredAt'>): boolean {
        if (this.extensions.has(ext.id)) return false;
        this.extensions.set(ext.id, {
            ...ext,
            status: 'registered',
            registeredAt: Date.now(),
        });
        return true;
    }

    /**
     * Activate an extension.
     */
    async activate(id: string, config?: Record<string, unknown>): Promise<boolean> {
        const ext = this.extensions.get(id);
        if (!ext || ext.status === 'active') return false;

        try {
            if (ext.setup) await ext.setup(config ?? ext.config ?? {});
            ext.status = 'active';
            return true;
        } catch (err) {
            ext.status = 'error';
            ext.error = err instanceof Error ? err.message : String(err);
            return false;
        }
    }

    /**
     * Deactivate an extension.
     */
    async deactivate(id: string): Promise<boolean> {
        const ext = this.extensions.get(id);
        if (!ext || ext.status !== 'active') return false;

        try {
            if (ext.teardown) await ext.teardown();
            ext.status = 'inactive';
            return true;
        } catch {
            ext.status = 'error';
            return false;
        }
    }

    /**
     * Get an extension.
     */
    get(id: string): Extension | null {
        return this.extensions.get(id) ?? null;
    }

    /**
     * Unregister an extension.
     */
    unregister(id: string): boolean {
        return this.extensions.delete(id);
    }

    /**
     * List by type.
     */
    listByType(type?: ExtensionType): Array<{ id: string; name: string; type: ExtensionType; status: string }> {
        return Array.from(this.extensions.values())
            .filter((e) => !type || e.type === type)
            .map((e) => ({ id: e.id, name: e.name, type: e.type, status: e.status }));
    }

    /**
     * Get active extensions.
     */
    getActive(): Extension[] {
        return Array.from(this.extensions.values()).filter((e) => e.status === 'active');
    }

    /** Count */
    count(): number { return this.extensions.size; }
}
