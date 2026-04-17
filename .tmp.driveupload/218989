/**
 * agents/provider-profiles/paths.ts
 *
 * CoreBlow — agents/auth-profiles/paths.ts
 * Adaptasi: gunakan resolveStateDir() dari CoreBlow config/paths.ts
 * (bukan resolveUserPath/resolveCoreBlowAgentDir dari OC)
 */
import fs from 'node:fs';
import path from 'node:path';
import { resolveStateDir } from '../../config/paths.js';
import { PROVIDER_PROFILE_FILENAME, PROVIDER_STORE_VERSION } from './constants.js';
import type { ProviderProfileStore } from './types.js';

/**
 * Resolve path ke provider-profiles.json.
 * Menggunakan COREBLOW_STATE_DIR env → fallback ke ~/.coreblow/
 *
 * CoreBlow — agents/auth-profiles/paths.ts resolveAuthStorePath()
 */
export function resolveProviderStorePath(env: NodeJS.ProcessEnv = process.env): string {
    return path.join(resolveStateDir(env), PROVIDER_PROFILE_FILENAME);
}

/**
 * Ensure provider-profiles.json exists dengan empty store.
 * CoreBlow — agents/auth-profiles/paths.ts ensureAuthStoreFile()
 */
export function ensureProviderStoreFile(storePath: string): void {
    if (fs.existsSync(storePath)) return;
    const dir = path.dirname(storePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    const payload: ProviderProfileStore = {
        version: PROVIDER_STORE_VERSION,
        usageStats: {},
    };
    fs.writeFileSync(storePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    fs.chmodSync(storePath, 0o600);
}
