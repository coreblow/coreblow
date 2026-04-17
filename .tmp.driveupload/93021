/**
 * CoreBlow — Fixture Manager
 *
 * Manages test fixtures (sample data) for consistent
 * test environments. Supports factory functions,
 * overrides, and fixture sets.
 */

/** Fixture factory */
export type FixtureFactory<T> = (overrides?: Partial<T>) => T;

/**
 * CoreBlow Fixture Manager
 */
export class FixtureManager {
    private factories = new Map<string, FixtureFactory<unknown>>();
    private sets = new Map<string, Array<{ name: string; overrides: Record<string, unknown> }>>();

    /**
     * Register a fixture factory.
     */
    define<T>(name: string, factory: FixtureFactory<T>): void {
        this.factories.set(name, factory as FixtureFactory<unknown>);
    }

    /**
     * Create a fixture instance.
     */
    create<T>(name: string, overrides?: Partial<T>): T {
        const factory = this.factories.get(name);
        if (!factory) throw new Error(`Fixture "${name}" not found`);
        return factory(overrides as Partial<unknown>) as T;
    }

    /**
     * Create multiple instances.
     */
    createMany<T>(name: string, count: number, overrides?: Partial<T>): T[] {
        return Array.from({ length: count }, () => this.create<T>(name, overrides));
    }

    /**
     * Define a fixture set (collection of named fixtures).
     */
    defineSet(setName: string, items: Array<{ name: string; overrides?: Record<string, unknown> }>): void {
        this.sets.set(setName, items.map((i) => ({ name: i.name, overrides: i.overrides ?? {} })));
    }

    /**
     * Load a fixture set.
     */
    loadSet(setName: string): unknown[] {
        const items = this.sets.get(setName);
        if (!items) return [];
        return items.map((item) => this.create(item.name, item.overrides));
    }

    /**
     * List fixture names.
     */
    list(): string[] {
        return Array.from(this.factories.keys());
    }

    /**
     * List set names.
     */
    listSets(): string[] {
        return Array.from(this.sets.keys());
    }

    /** Count */
    count(): number { return this.factories.size; }
}
