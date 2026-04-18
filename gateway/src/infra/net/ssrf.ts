/**
 * CoreBlow — SSRF Protection
 *
 * Server-Side Request Forgery protection via:
 * - DNS pinning (resolve hostname, then bind to resolved IPs)
 * - Private/internal IP blocking
 * - Hostname blocklist
 * - Policy-based allowlists
 *
 * Used by all outbound HTTP request paths to prevent
 * SSRF attacks through user-controlled URLs.
 */

import { lookup as dnsLookupCb, type LookupAddress } from 'node:dns';
import { lookup as dnsLookup } from 'node:dns/promises';
import { normalizeHostname } from './hostname.js';

// ─── Error Types ────────────────────────────────────────────────────────────

export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfBlockedError';
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type LookupFn = typeof dnsLookup;

export interface SsrfPolicy {
  /** Allow requests to private network ranges (10.x, 192.168.x, etc.) */
  allowPrivateNetwork?: boolean;
  /** Hostnames that bypass all SSRF checks */
  allowedHostnames?: string[];
  /** Hostname allowlist — if set, ONLY these hostnames are permitted */
  hostnameAllowlist?: string[];
}

export interface PinnedHostname {
  hostname: string;
  addresses: string[];
  lookup: typeof dnsLookupCb;
}

// ─── Blocked Hostnames ──────────────────────────────────────────────────────

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
]);

const BLOCKED_HOSTNAME_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
];

// ─── IPv4 Private Range Detection ───────────────────────────────────────────

function parseIpv4Octets(address: string): number[] | null {
  const parts = address.split('.');
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    const num = parseInt(part, 10);
    if (isNaN(num) || num < 0 || num > 255 || String(num) !== part) return null;
    octets.push(num);
  }
  return octets;
}

function isPrivateIpv4(octets: number[]): boolean {
  const [a, b] = octets;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 127.0.0.0/8 (loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (link-local)
  if (a === 169 && b === 254) return true;
  // 0.0.0.0/8
  if (a === 0) return true;
  return false;
}

function isPrivateIpv6(address: string): boolean {
  const lower = address.toLowerCase();
  // Loopback
  if (lower === '::1') return true;
  // Link-local
  if (lower.startsWith('fe80:')) return true;
  // Unique local address
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  // IPv4-mapped private
  if (lower.startsWith('::ffff:')) {
    const v4Part = lower.slice(7);
    const octets = parseIpv4Octets(v4Part);
    if (octets && isPrivateIpv4(octets)) return true;
  }
  return false;
}

// ─── Core Checks ────────────────────────────────────────────────────────────

/**
 * Check if an IP address is private/internal/special-use.
 */
export function isPrivateIpAddress(address: string): boolean {
  let normalized = address.trim().toLowerCase();
  // Unwrap IPv6 brackets
  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    normalized = normalized.slice(1, -1);
  }
  if (!normalized) return false;

  // IPv4
  const octets = parseIpv4Octets(normalized);
  if (octets) return isPrivateIpv4(octets);

  // IPv6
  if (normalized.includes(':')) return isPrivateIpv6(normalized);

  return false;
}

/**
 * Check if a hostname is in the blocked list.
 */
export function isBlockedHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return false;
  if (BLOCKED_HOSTNAMES.has(normalized)) return true;
  return BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

/**
 * Check if a hostname or IP address should be blocked.
 */
export function isBlockedHostnameOrIp(hostname: string, policy?: SsrfPolicy): boolean {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return false;
  if (isBlockedHostname(normalized)) return true;

  // Check hostname allowlist
  if (policy?.allowedHostnames?.some((h) => normalizeHostname(h) === normalized)) return false;
  if (policy?.allowPrivateNetwork) return false;

  return isPrivateIpAddress(normalized);
}

// ─── DNS Pinning ────────────────────────────────────────────────────────────

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

/**
 * Create a pinned DNS lookup function that always returns
 * pre-resolved addresses for a given hostname.
 */
export function createPinnedLookup(params: {
  hostname: string;
  addresses: string[];
  fallback?: typeof dnsLookupCb;
}): typeof dnsLookupCb {
  const normalizedHost = normalizeHostname(params.hostname);
  if (params.addresses.length === 0) {
    throw new Error(`Pinned lookup requires at least one address for ${params.hostname}`);
  }

  const fallback = (params.fallback ?? dnsLookupCb) as (...args: unknown[]) => void;
  const records = params.addresses.map((addr) => ({
    address: addr,
    family: addr.includes(':') ? 6 : 4,
  }));
  let index = 0;

  return ((host: string, options?: unknown, callback?: unknown) => {
    const cb: LookupCallback =
      typeof options === 'function'
        ? (options as LookupCallback)
        : (callback as LookupCallback);

    if (!cb) return;

    const normalized = normalizeHostname(host);
    if (normalized !== normalizedHost) {
      return fallback(host, ...(typeof options === 'function' ? [cb] : [options, cb]));
    }

    const opts = typeof options === 'object' && options !== null
      ? (options as { all?: boolean; family?: number })
      : {};

    const requestedFamily = typeof options === 'number' ? options : (opts.family ?? 0);
    const candidates = requestedFamily === 4 || requestedFamily === 6
      ? records.filter((r) => r.family === requestedFamily)
      : records;

    const usable = candidates.length > 0 ? candidates : records;

    if (opts.all) {
      cb(null, usable as LookupAddress[]);
      return;
    }

    const chosen = usable[index % usable.length];
    index++;
    cb(null, chosen.address, chosen.family);
  }) as typeof dnsLookupCb;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Resolve a hostname with SSRF protection.
 * Performs DNS lookup, validates all resolved IPs are public,
 * and returns a pinned lookup function for the connection.
 */
export async function resolvePinnedHostname(
  hostname: string,
  params: { lookupFn?: LookupFn; policy?: SsrfPolicy } = {},
): Promise<PinnedHostname> {
  const normalized = normalizeHostname(hostname);
  if (!normalized) throw new Error('Invalid hostname');

  // Phase 1: Pre-DNS validation
  const skipPrivateChecks = params.policy?.allowPrivateNetwork ||
    params.policy?.allowedHostnames?.some((h) => normalizeHostname(h) === normalized);

  // Check hostname allowlist
  if (params.policy?.hostnameAllowlist) {
    const allowlist = params.policy.hostnameAllowlist.map(normalizeHostname).filter(Boolean);
    if (allowlist.length > 0 && !allowlist.includes(normalized)) {
      throw new SsrfBlockedError(`Blocked hostname (not in allowlist): ${hostname}`);
    }
  }

  if (!skipPrivateChecks && isBlockedHostnameOrIp(normalized, params.policy)) {
    throw new SsrfBlockedError('Blocked hostname or private/internal IP address');
  }

  // Phase 2: DNS resolution
  const lookupFn = params.lookupFn ?? dnsLookup;
  const results = await lookupFn(normalized, { all: true });

  if (results.length === 0) {
    throw new Error(`Unable to resolve hostname: ${hostname}`);
  }

  // Phase 3: Validate resolved addresses
  if (!skipPrivateChecks) {
    for (const entry of results) {
      if (isBlockedHostnameOrIp(entry.address, params.policy)) {
        throw new SsrfBlockedError('Blocked: resolves to private/internal IP address');
      }
    }
  }

  // Prefer IPv4 addresses
  const seen = new Set<string>();
  const ipv4: string[] = [];
  const ipv6: string[] = [];
  for (const entry of results) {
    if (seen.has(entry.address)) continue;
    seen.add(entry.address);
    if (entry.family === 4) ipv4.push(entry.address);
    else ipv6.push(entry.address);
  }
  const addresses = [...ipv4, ...ipv6];

  return {
    hostname: normalized,
    addresses,
    lookup: createPinnedLookup({ hostname: normalized, addresses }),
  };
}

/** Assert that a hostname resolves to public IPs */
export async function assertPublicHostname(
  hostname: string,
  lookupFn: LookupFn = dnsLookup,
): Promise<void> {
  await resolvePinnedHostname(hostname, { lookupFn });
}
