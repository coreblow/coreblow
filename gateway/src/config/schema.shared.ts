/**
 * config/schema.shared.ts
 * Schema utilities shared between config validation & gateway config API.
 */

/** Standard config section names used across modules. */
export const CONFIG_SECTIONS = [
    'gateway', 'models', 'agents', 'channels', 'sandbox',
    'hooks', 'plugins', 'sessions', 'secrets', 'tools',
] as const;

export type ConfigSection = typeof CONFIG_SECTIONS[number];

/** Check if a string is a valid config section. */
export function isConfigSection(s: string): s is ConfigSection {
    return (CONFIG_SECTIONS as readonly string[]).includes(s);
}

/** Normalize a config key to dot-notation. */
export function normalizeConfigKey(key: string): string {
    return key.replace(/\[(\d+)\]/g, '.$1').replace(/^\./, '');
}

/** Compare two config objects and return changed keys. */
export function diffConfigKeys(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}
