/**
 * CoreBlow — Service Patterns
 *
 * Shared patterns and utilities for the OOP refactoring of src/infra/.
 * Provides type-safe singleton factory, guarded __testing hooks, and
 * base types for Tier-1 (Standalone Singleton) services.
 */

// ---------------------------------------------------------------------------
// Guarded Testing Hooks
// ---------------------------------------------------------------------------

/**
 * Create a NODE_ENV-guarded __testing export for a singleton service.
 *
 * The `reset()` and `set()` methods are no-ops in production to prevent
 * accidental singleton nullification from any of the 2,700+ consumer files.
 *
 * @example
 * ```ts
 * let _instance: MyService | null = null;
 * export const __testing = createTestingHooks(
 *   () => { _instance = null; },
 *   (svc) => { _instance = svc; },
 * );
 * ```
 */
export function createTestingHooks<T>(
    resetFn: () => void,
    setFn: (instance: T) => void,
): { reset(): void; set(instance: T): void } {
    return {
        reset() {
            if (process.env.NODE_ENV !== 'test') return;
            resetFn();
        },
        set(instance: T) {
            if (process.env.NODE_ENV !== 'test') return;
            setFn(instance);
        },
    };
}

// ---------------------------------------------------------------------------
// Standalone Singleton Factory (Tier-1 Pattern)
// ---------------------------------------------------------------------------

/**
 * Options for creating a standalone singleton service.
 */
export interface StandaloneSingletonOptions<TDeps, TService> {
    /** Factory function that creates the service instance from deps. */
    create: (deps: TDeps) => TService;
    /** Default dependencies used by the module-level singleton. */
    defaultDeps: TDeps;
}

/**
 * Result of creating a standalone singleton, providing access to the lazy
 * instance, the class, and guarded testing hooks.
 */
export interface StandaloneSingleton<TDeps, TService> {
    /** Get the lazy-initialized default singleton instance. */
    getInstance: () => TService;
    /** NODE_ENV-guarded testing hooks. */
    __testing: {
        reset(): void;
        set(instance: TService): void;
    };
}

/**
 * Create a Tier-1 standalone singleton with lazy initialization and
 * guarded testing hooks.
 *
 * @example
 * ```ts
 * const { getInstance, __testing } = createStandaloneSingleton({
 *   create: (deps) => new BoundaryPathService(deps),
 *   defaultDeps: { readFile: fs.readFile, resolvePath: path.resolve },
 * });
 *
 * // Backward-compat re-exports:
 * export const resolveBoundaryPath = (root, b) => getInstance().resolve(root, b);
 * export { __testing };
 * ```
 */
export function createStandaloneSingleton<TDeps, TService>(
    options: StandaloneSingletonOptions<TDeps, TService>,
): StandaloneSingleton<TDeps, TService> {
    let _instance: TService | null = null;

    const getInstance = (): TService => {
        if (!_instance) {
            _instance = options.create(options.defaultDeps);
        }
        return _instance;
    };

    const __testing = createTestingHooks<TService>(
        () => { _instance = null; },
        (svc) => { _instance = svc; },
    );

    return { getInstance, __testing };
}
