/**
 * agents/provider-profiles/index.ts
 *
 * Public API barrel untuk provider-profiles subsystem.
 * CoreBlow — agents/auth-profiles.ts
 */

export {
    loadProviderProfileStore,
    saveProviderProfileStore,
    updateProviderProfileStoreWithLock,
    clearProviderProfileStoreCache,
} from './store.js';

export {
    isProviderInCooldown,
    markProviderFailure,
    markProviderUsed,
    clearProviderCooldown,
    clearExpiredCooldowns,
    getSoonestCooldownExpiry,
    resolveProvidersUnavailableReason,
    resolveProviderUnusableUntil,
    calculateProviderCooldownMs,
    __testing,
} from './usage.js';

export { resolveProviderStorePath, ensureProviderStoreFile } from './paths.js';
export { PROVIDER_STORE_VERSION, PROVIDER_PROFILE_FILENAME } from './constants.js';
export type { ProviderProfileStore, ProviderUsageStats, CooldownConfig } from './types.js';
