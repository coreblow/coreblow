/**
 * CoreBlow — Config Merge/Patch
 *
 * Deep merge utilities for config objects.
 * Supports partial updates, array merging strategies, and null removal.
 *
 * @packageDocumentation
 */

/**
 * Deep merge two objects. Source overrides target for scalar values.
 * For objects, merge recursively. Arrays are replaced entirely.
 */
export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
    const result = { ...target };

    for (const key of Object.keys(source) as Array<keyof T>) {
        const sourceVal = source[key];
        const targetVal = result[key];

        if (sourceVal === undefined) continue;

        if (sourceVal === null) {
            // null explicitly removes the key
            delete result[key];
        } else if (
            typeof sourceVal === 'object' &&
            !Array.isArray(sourceVal) &&
            typeof targetVal === 'object' &&
            !Array.isArray(targetVal) &&
            targetVal !== null
        ) {
            result[key] = deepMerge(
                targetVal as Record<string, unknown>,
                sourceVal as Record<string, unknown>,
            ) as T[keyof T];
        } else {
            result[key] = sourceVal as T[keyof T];
        }
    }

    return result;
}

/**
 * Apply a JSON Merge Patch (RFC 7396) to a config object.
 */
export function mergePatch<T extends Record<string, unknown>>(target: T, patch: Record<string, unknown>): T {
    if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) {
        return patch as T;
    }

    const result = { ...target } as Record<string, unknown>;

    for (const [key, value] of Object.entries(patch)) {
        if (value === null) {
            delete result[key];
        } else if (typeof value === 'object' && !Array.isArray(value) && typeof result[key] === 'object' && result[key] !== null) {
            result[key] = mergePatch(result[key] as Record<string, unknown>, value as Record<string, unknown>);
        } else {
            result[key] = value;
        }
    }

    return result as T;
}

/**
 * Extract a diff between two configs (only changed keys).
 */
export function configDiff(
    original: Record<string, unknown>,
    modified: Record<string, unknown>,
    prefix = '',
): Array<{ path: string; from: unknown; to: unknown }> {
    const diffs: Array<{ path: string; from: unknown; to: unknown }> = [];
    const allKeys = new Set([...Object.keys(original), ...Object.keys(modified)]);

    for (const key of allKeys) {
        const path = prefix ? `${prefix}.${key}` : key;
        const a = original[key];
        const b = modified[key];

        if (a === b) continue;

        if (
            typeof a === 'object' && a !== null && !Array.isArray(a) &&
            typeof b === 'object' && b !== null && !Array.isArray(b)
        ) {
            diffs.push(...configDiff(a as Record<string, unknown>, b as Record<string, unknown>, path));
        } else {
            diffs.push({ path, from: a, to: b });
        }
    }

    return diffs;
}

/**
 * Flatten a nested config object to dotted paths.
 */
export function flattenConfig(
    obj: Record<string, unknown>,
    prefix = '',
): Record<string, unknown> {
    const flat: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            Object.assign(flat, flattenConfig(value as Record<string, unknown>, path));
        } else {
            flat[path] = value;
        }
    }

    return flat;
}

/**
 * Unflatten dotted paths back to nested object.
 */
export function unflattenConfig(flat: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [path, value] of Object.entries(flat)) {
        const parts = path.split('.');
        let current = result;
        for (let i = 0; i < parts.length - 1; i++) {
            if (typeof current[parts[i]] !== 'object' || current[parts[i]] === null) {
                current[parts[i]] = {};
            }
            current = current[parts[i]] as Record<string, unknown>;
        }
        current[parts[parts.length - 1]] = value;
    }

    return result;
}
