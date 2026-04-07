/** Model auth status markers. */
export type AuthMarker = 'valid' | 'expired' | 'missing' | 'refreshing';
export function getAuthMarkerIcon(marker: AuthMarker): string { const icons: Record<AuthMarker, string> = { valid: '✅', expired: '❌', missing: '⚠️', refreshing: '🔄' }; return icons[marker]; }
