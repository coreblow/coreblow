/**
 * utils/string-utils2.ts
 */
export function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); } export function camelToKebab(s: string) { return s.replace(/([A-Z])/g, '-$1').toLowerCase(); } export function kebabToCamel(s: string) { return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); }
export function truncateLengthString(s: string, l: number) { return s.substring(0, l); }
