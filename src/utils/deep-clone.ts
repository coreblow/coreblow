/**
 * utils/deep-clone.ts
 */
export function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(deepClone) as T;
    const clone = {} as Record<string, unknown>;
    for (const key of Object.keys(obj as object)) {
        clone[key] = deepClone((obj as Record<string, unknown>)[key]);
    }
    return clone as T;
}
