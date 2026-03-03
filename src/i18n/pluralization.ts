/**
 * i18n/pluralization.ts
 */
export function pluralize(count: number, singular: string, plural: string): string { return count === 1 ? singular : plural; } export function formatCount(count: number, singular: string, plural: string): string { return `${count} ${pluralize(count, singular, plural)}`; }
