/**
 * CoreBlow — Undici Runtime Dependency Loader
 *
 * Lazy-loads undici Agent/ProxyAgent constructors at runtime.
 * This avoids bundling undici as a hard dependency and allows
 * graceful fallback when undici is not available.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UndiciDeps {
  Agent: new (opts?: Record<string, unknown>) => unknown;
  ProxyAgent: new (opts: string | Record<string, unknown>) => unknown;
  EnvHttpProxyAgent: new (opts?: Record<string, unknown>) => unknown;
}

// ─── Cached Deps ────────────────────────────────────────────────────────────

let cachedDeps: UndiciDeps | null = null;

/**
 * Lazily load undici runtime dependencies.
 * Throws if undici is not installed.
 */
export function loadUndiciRuntimeDeps(): UndiciDeps {
  if (cachedDeps) return cachedDeps;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const undici = require('undici');
    cachedDeps = {
      Agent: undici.Agent,
      ProxyAgent: undici.ProxyAgent,
      EnvHttpProxyAgent: undici.EnvHttpProxyAgent,
    };
    return cachedDeps;
  } catch {
    throw new Error(
      '[coreblow] undici is required for advanced HTTP features. ' +
      'Install it with: npm install undici',
    );
  }
}

/**
 * Check if undici is available without throwing.
 */
export function isUndiciAvailable(): boolean {
  try {
    loadUndiciRuntimeDeps();
    return true;
  } catch {
    return false;
  }
}

/** Reset the cache (for testing) */
export function resetUndiciCache(): void {
  cachedDeps = null;
}
