/**
 * CoreBlow CLI Credentials Manager
 *
 * Manages CLI-level credential storage, retrieval, and secure handling
 * for interactive sessions. Supports keychain integration, env-file based
 * auth, and secure credential prompting.
 *
 * Equivalent: CoreBlow src/agents/cli-credentials.ts (580 LOC)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createChildLogger } from '../utils/logger.js';
import { maskApiKey } from './model-auth.js';

const log = createChildLogger('cli-credentials');

// ─── Types ────────────────────────────────────────────────────────

export interface StoredCredential {
    provider: string;
    key: string;
    name?: string;
    createdAt: number;
    updatedAt: number;
    source: 'interactive' | 'env-file' | 'keychain' | 'config';
}

export interface CredentialStore {
    version: number;
    credentials: StoredCredential[];
    lastModified: number;
}

export interface CredentialPromptResult {
    provider: string;
    key: string;
    save: boolean;
}

// ─── Constants ────────────────────────────────────────────────────

const STORE_VERSION = 1;
const DEFAULT_CREDENTIALS_FILE = '.coreblow-credentials.json';

// ─── In-Memory Store ──────────────────────────────────────────────

let memoryStore: CredentialStore = {
    version: STORE_VERSION,
    credentials: [],
    lastModified: Date.now(),
};

/**
 * Get the credentials file path
 */
export function getCredentialsPath(homeDir?: string): string {
    const home = homeDir ?? process.env['HOME'] ?? process.env['USERPROFILE'] ?? '/tmp';
    return path.join(home, '.coreblow', DEFAULT_CREDENTIALS_FILE);
}

/**
 * Load credentials from disk
 */
export function loadCredentials(filePath?: string): CredentialStore {
    const credPath = filePath ?? getCredentialsPath();

    try {
        if (!fs.existsSync(credPath)) {
            return { version: STORE_VERSION, credentials: [], lastModified: Date.now() };
        }

        const content = fs.readFileSync(credPath, 'utf-8');
        const parsed = JSON.parse(content) as CredentialStore;

        if (parsed.version !== STORE_VERSION) {
            log.warn({ storedVersion: parsed.version, currentVersion: STORE_VERSION }, 'Credential store version mismatch');
        }

        memoryStore = parsed;
        return parsed;
    } catch (err) {
        log.error({ path: credPath, error: (err as Error).message }, 'Failed to load credentials');
        return { version: STORE_VERSION, credentials: [], lastModified: Date.now() };
    }
}

/**
 * Save credentials to disk
 */
export function saveCredentials(filePath?: string): boolean {
    const credPath = filePath ?? getCredentialsPath();

    try {
        const dir = path.dirname(credPath);
        fs.mkdirSync(dir, { recursive: true });

        memoryStore.lastModified = Date.now();
        const content = JSON.stringify(memoryStore, null, 2);

        // Write with restricted permissions
        fs.writeFileSync(credPath, content, { mode: 0o600 });
        log.debug({ path: credPath }, 'Credentials saved');
        return true;
    } catch (err) {
        log.error({ path: credPath, error: (err as Error).message }, 'Failed to save credentials');
        return false;
    }
}

/**
 * Add or update a credential
 */
export function setCredential(provider: string, key: string, options?: {
    name?: string;
    source?: StoredCredential['source'];
    save?: boolean;
}): StoredCredential {
    const normalized = provider.trim().toLowerCase();
    const now = Date.now();

    // Remove existing for this provider
    memoryStore.credentials = memoryStore.credentials.filter((c) => c.provider !== normalized);

    const credential: StoredCredential = {
        provider: normalized,
        key,
        name: options?.name,
        createdAt: now,
        updatedAt: now,
        source: options?.source ?? 'interactive',
    };

    memoryStore.credentials.push(credential);
    memoryStore.lastModified = now;

    if (options?.save !== false) {
        saveCredentials();
    }

    log.info({ provider: normalized, source: credential.source, masked: maskApiKey(key) }, 'Credential set');
    return credential;
}

/**
 * Get a credential for a provider
 */
export function getCredential(provider: string): StoredCredential | undefined {
    return memoryStore.credentials.find((c) => c.provider === provider.trim().toLowerCase());
}

/**
 * Remove a credential
 */
export function removeCredential(provider: string, save: boolean = true): boolean {
    const normalized = provider.trim().toLowerCase();
    const before = memoryStore.credentials.length;
    memoryStore.credentials = memoryStore.credentials.filter((c) => c.provider !== normalized);
    const removed = memoryStore.credentials.length < before;

    if (removed) {
        memoryStore.lastModified = Date.now();
        if (save) saveCredentials();
        log.info({ provider: normalized }, 'Credential removed');
    }

    return removed;
}

/**
 * List all stored credentials (with masked keys)
 */
export function listCredentials(): Array<{
    provider: string;
    maskedKey: string;
    name?: string;
    source: string;
    updatedAt: number;
}> {
    return memoryStore.credentials.map((c) => ({
        provider: c.provider,
        maskedKey: maskApiKey(c.key),
        name: c.name,
        source: c.source,
        updatedAt: c.updatedAt,
    }));
}

/**
 * Clear all stored credentials
 */
export function clearCredentials(save: boolean = true): void {
    memoryStore.credentials = [];
    memoryStore.lastModified = Date.now();
    if (save) saveCredentials();
}

// ─── Env File Support ─────────────────────────────────────────────

/**
 * Load credentials from a .env file
 */
export function loadFromEnvFile(envPath: string): StoredCredential[] {
    const loaded: StoredCredential[] = [];

    try {
        if (!fs.existsSync(envPath)) return loaded;

        const content = fs.readFileSync(envPath, 'utf-8');
        const envMap: Record<string, string> = {
            OPENAI_API_KEY: 'openai',
            ANTHROPIC_API_KEY: 'anthropic',
            GOOGLE_API_KEY: 'google',
            GEMINI_API_KEY: 'google',
            XAI_API_KEY: 'xai',
            OPENROUTER_API_KEY: 'openrouter',
            DEEPSEEK_API_KEY: 'deepseek',
            MISTRAL_API_KEY: 'mistral',
            GROQ_API_KEY: 'groq',
        };

        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            const eqIdx = trimmed.indexOf('=');
            if (eqIdx === -1) continue;

            const key = trimmed.slice(0, eqIdx).trim();
            let value = trimmed.slice(eqIdx + 1).trim();
            // Remove quotes
            value = value.replace(/^['"]|['"]$/g, '');

            const provider = envMap[key];
            if (provider && value) {
                const credential = setCredential(provider, value, {
                    source: 'env-file',
                    save: false,
                });
                loaded.push(credential);
            }
        }

        log.info({ path: envPath, count: loaded.length }, 'Loaded credentials from env file');
    } catch (err) {
        log.error({ path: envPath, error: (err as Error).message }, 'Failed to load env file');
    }

    return loaded;
}

// ─── Validation ───────────────────────────────────────────────────

/**
 * Validate stored credential format
 */
export function validateCredential(credential: StoredCredential): { valid: boolean; error?: string } {
    if (!credential.provider) return { valid: false, error: 'Missing provider' };
    if (!credential.key) return { valid: false, error: 'Missing key' };
    if (credential.key.includes(' ')) return { valid: false, error: 'Key contains spaces' };
    if (credential.key.length < 10) return { valid: false, error: 'Key too short' };
    return { valid: true };
}

/**
 * Get credential store diagnostics
 */
export function getStoreDiagnostics(): {
    totalCredentials: number;
    providers: string[];
    lastModified: number;
    storeVersion: number;
    hasFile: boolean;
} {
    return {
        totalCredentials: memoryStore.credentials.length,
        providers: memoryStore.credentials.map((c) => c.provider),
        lastModified: memoryStore.lastModified,
        storeVersion: memoryStore.version,
        hasFile: fs.existsSync(getCredentialsPath()),
    };
}
