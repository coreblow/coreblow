/**
 * agents/provider-profiles/constants.ts
 *
 * CoreBlow — agents/auth-profiles/constants.ts
 * Adaptasi: CoreBlow tidak punya subsystem logger khusus, pakai createChildLogger
 */
import { createChildLogger } from '../../utils/logger.js';

export const PROVIDER_STORE_VERSION = 1;
export const PROVIDER_PROFILE_FILENAME = 'provider-profiles.json';

/**
 * File lock options untuk provider-profiles.json.
 * Port identik dari CoreBlow AUTH_STORE_LOCK_OPTIONS.
 */
export const PROVIDER_STORE_LOCK_OPTIONS = {
    retries: {
        retries: 10,
        factor: 2,
        minTimeout: 100,
        maxTimeout: 10_000,
        randomize: true,
    },
    stale: 30_000,
} as const;

export const log = createChildLogger('agents/provider-profiles');
