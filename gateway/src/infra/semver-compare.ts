/**
 * CoreBlow — Semantic Version Utilities
 *
 * Zero-dependency semver parsing, comparison, and range matching.
 * Supports standard Major.Minor.Patch with optional prerelease tags.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ParsedSemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease: string;
  raw: string;
}

export type SemVerComparison = -1 | 0 | 1;

// ─── Parser ─────────────────────────────────────────────────────────────────

const SEMVER_REGEX = /^v?(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.]+))?/;

/**
 * Parse a version string into components.
 * Returns null if the string is not a valid semver.
 */
export function parseSemVer(version: string): ParsedSemVer | null {
  const trimmed = version.trim();
  const match = SEMVER_REGEX.exec(trimmed);
  if (!match) return null;

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] ?? '',
    raw: trimmed,
  };
}

// ─── Comparison ─────────────────────────────────────────────────────────────

function compareNumber(a: number, b: number): SemVerComparison {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function comparePrerelease(a: string, b: string): SemVerComparison {
  // No prerelease = higher precedence than any prerelease
  if (!a && !b) return 0;
  if (!a && b) return 1;   // 1.0.0 > 1.0.0-alpha
  if (a && !b) return -1;  // 1.0.0-alpha < 1.0.0

  const aParts = a.split('.');
  const bParts = b.split('.');
  const len = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < len; i++) {
    const ap = aParts[i];
    const bp = bParts[i];

    if (ap === undefined && bp !== undefined) return -1;
    if (ap !== undefined && bp === undefined) return 1;
    if (ap === bp) continue;

    const aNum = parseInt(ap, 10);
    const bNum = parseInt(bp, 10);
    const aIsNum = !isNaN(aNum) && String(aNum) === ap;
    const bIsNum = !isNaN(bNum) && String(bNum) === bp;

    // Numeric identifiers always have lower precedence than string
    if (aIsNum && !bIsNum) return -1;
    if (!aIsNum && bIsNum) return 1;
    if (aIsNum && bIsNum) return compareNumber(aNum, bNum);

    // Both are strings
    if (ap < bp) return -1;
    if (ap > bp) return 1;
  }

  return 0;
}

/**
 * Compare two semver strings.
 * Returns -1 if a < b, 0 if equal, 1 if a > b.
 */
export function compareSemVer(a: string, b: string): SemVerComparison {
  const parsedA = parseSemVer(a);
  const parsedB = parseSemVer(b);

  if (!parsedA || !parsedB) {
    // Fallback: string comparison for unparseable versions
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }

  const majorCmp = compareNumber(parsedA.major, parsedB.major);
  if (majorCmp !== 0) return majorCmp;

  const minorCmp = compareNumber(parsedA.minor, parsedB.minor);
  if (minorCmp !== 0) return minorCmp;

  const patchCmp = compareNumber(parsedA.patch, parsedB.patch);
  if (patchCmp !== 0) return patchCmp;

  return comparePrerelease(parsedA.prerelease, parsedB.prerelease);
}

// ─── Convenience ────────────────────────────────────────────────────────────

/** Returns true if version a is newer than version b */
export function isNewerThan(a: string, b: string): boolean {
  return compareSemVer(a, b) === 1;
}

/** Returns true if version a is older than version b */
export function isOlderThan(a: string, b: string): boolean {
  return compareSemVer(a, b) === -1;
}

/** Returns true if both versions are equal (ignoring v-prefix) */
export function isSameVersion(a: string, b: string): boolean {
  return compareSemVer(a, b) === 0;
}

/**
 * Sort an array of version strings in ascending order.
 * Non-parseable versions are sorted to the end.
 */
export function sortVersions(versions: string[]): string[] {
  return [...versions].sort(compareSemVer);
}

/** Returns the latest version from an array of version strings */
export function latestVersion(versions: string[]): string | null {
  if (versions.length === 0) return null;
  return sortVersions(versions).at(-1) ?? null;
}

/**
 * Check if a version satisfies a minimum requirement.
 * Equivalent to: version >= minVersion
 */
export function satisfiesMinimum(version: string, minVersion: string): boolean {
  return compareSemVer(version, minVersion) >= 0;
}
