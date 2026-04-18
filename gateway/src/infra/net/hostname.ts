/**
 * CoreBlow — Hostname Normalization
 *
 * Consistent hostname normalization used across SSRF protection,
 * DNS pinning, and outbound request routing.
 */

/**
 * Normalize a hostname string:
 * - Trim whitespace
 * - Convert to lowercase
 * - Strip trailing dots
 * - Unwrap IPv6 bracket notation
 */
export function normalizeHostname(hostname: string): string {
  const trimmed = hostname.trim().toLowerCase().replace(/\.+$/, '');
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Check if two hostnames are equivalent after normalization.
 */
export function hostnamesMatch(a: string, b: string): boolean {
  return normalizeHostname(a) === normalizeHostname(b);
}

/**
 * Extract the registrable domain from a hostname.
 * e.g., 'api.staging.example.com' → 'example.com'
 * NOTE: This is a heuristic — does not use the PSL.
 */
export function extractBaseDomain(hostname: string): string {
  const normalized = normalizeHostname(hostname);
  const parts = normalized.split('.');
  if (parts.length <= 2) return normalized;
  return parts.slice(-2).join('.');
}

/**
 * Check if a hostname matches a wildcard pattern.
 * Supports leading `*.` patterns (e.g., `*.example.com`).
 */
export function hostnameMatchesPattern(hostname: string, pattern: string): boolean {
  const normalizedHost = normalizeHostname(hostname);
  const normalizedPattern = normalizeHostname(pattern);

  if (normalizedPattern.startsWith('*.')) {
    const suffix = normalizedPattern.slice(2);
    if (!suffix || normalizedHost === suffix) return false;
    return normalizedHost.endsWith(`.${suffix}`);
  }

  return normalizedHost === normalizedPattern;
}
