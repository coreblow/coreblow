// @ts-nocheck
/**
 * gateway/startup-auth-profiles.ts
 * Load auth profiles from CoreBlow config into the model auth system.
 *
 * CoreBlow pattern: auth profiles live in config.json under `auth.profiles`,
 * supporting multi-key rotation, cost tracking, and budget limits.
 *
 * Resolution order:
 *   1. config.json → auth.profiles.{provider}
 *   2. Environment variables (ANTHROPIC_API_KEY, etc.)
 *   3. ~/.coreblow/auth-profiles.json (runtime store with usage tracking)
 */

import fs from 'node:fs';
import path from 'node:path';
import { createChildLogger } from '../utils/logger.js';
import { registerAuthProfile, resolveEnvApiKey, type AuthProfile } from '../agents/model-auth.js';
import { AUTH_ENV_VARS } from '../agents/model-auth-env-vars.js';

const log = createChildLogger('startup:auth-profiles');

// ─── Config Types ────────────────────────────────────────────────

interface ConfigAuthProfile {
    apiKey: string;
    baseUrl?: string;
    orgId?: string;
    label?: string;
    priority?: number;
}

interface CoreBlowConfig {
    auth?: {
        profiles?: Record<string, ConfigAuthProfile | ConfigAuthProfile[]>;
        order?: Record<string, string[]>;
    };
    agent?: {
        provider?: string;
        model?: string;
    };
    providers?: Record<string, {
        apiKey?: string;
        baseUrl?: string;
    }>;
}

// ─── Default Base URLs ───────────────────────────────────────────

const PROVIDER_BASE_URLS: Record<string, string> = {
    anthropic: 'https://api.anthropic.com',
    openai: 'https://api.openai.com/v1',
    google: 'https://generativelanguage.googleapis.com',
    deepseek: 'https://api.deepseek.com/v1',
    mistral: 'https://api.mistral.ai/v1',
    groq: 'https://api.groq.com/openai/v1',
    together: 'https://api.together.xyz/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    fireworks: 'https://api.fireworks.ai/inference/v1',
};

// ─── Loader ──────────────────────────────────────────────────────

/**
 * Load and register auth profiles from config + env into the model-auth registry.
 * Called once at gateway startup.
 */
export function loadAuthProfiles(configPath: string): { loaded: number; providers: string[] } {
    const loaded: string[] = [];

    // 1. Load from config.json → auth.profiles
    const config = readConfig(configPath);
    if (config?.auth?.profiles) {
        for (const [provider, value] of Object.entries(config.auth.profiles)) {
            const profiles = Array.isArray(value) ? value : [value];
            for (let i = 0; i < profiles.length; i++) {
                const p = profiles[i];
                if (!p.apiKey?.trim()) continue;

                const profile: AuthProfile = {
                    id: p.label ?? `config-${i}`,
                    provider,
                    apiKey: p.apiKey.trim(),
                    baseUrl: p.baseUrl ?? PROVIDER_BASE_URLS[provider],
                    orgId: p.orgId,
                    priority: p.priority ?? (100 - i), // config profiles are high priority
                };
                registerAuthProfile(profile);
                loaded.push(provider);
                log.info({ provider, id: profile.id, source: 'config' },
                    `Registered auth profile: ${provider} (${maskKey(p.apiKey)})`);
            }
        }
    }

    // 2. Legacy: config.providers.{name}.apiKey
    if (config?.providers) {
        for (const [provider, provConfig] of Object.entries(config.providers)) {
            if (!provConfig.apiKey?.trim()) continue;
            if (loaded.includes(provider)) continue; // config.auth.profiles takes precedence

            const profile: AuthProfile = {
                id: 'legacy-config',
                provider,
                apiKey: provConfig.apiKey.trim(),
                baseUrl: provConfig.baseUrl ?? PROVIDER_BASE_URLS[provider],
                priority: 50,
            };
            registerAuthProfile(profile);
            loaded.push(provider);
            log.info({ provider, source: 'providers' },
                `Registered legacy provider: ${provider} (${maskKey(provConfig.apiKey)})`);
        }
    }

    // 3. Environment variable fallback (for providers not yet covered)
    for (const [provider, envVar] of Object.entries(AUTH_ENV_VARS)) {
        if (loaded.includes(provider)) continue;
        const envKey = resolveEnvApiKey(provider);
        if (envKey) {
            const profile: AuthProfile = {
                id: 'env',
                provider,
                apiKey: envKey,
                baseUrl: PROVIDER_BASE_URLS[provider],
                priority: 10, // env is lowest priority
            };
            registerAuthProfile(profile);
            loaded.push(provider);
            log.info({ provider, envVar, source: 'env' },
                `Registered env profile: ${provider} (${maskKey(envKey)})`);
        }
    }

    if (loaded.length === 0) {
        log.warn({}, 'No LLM API keys configured. Add to ~/.coreblow/config.json → auth.profiles');
    } else {
        log.info({ count: loaded.length, providers: [...new Set(loaded)] },
            `Auth profiles ready: ${[...new Set(loaded)].join(', ')}`);
    }

    return { loaded: loaded.length, providers: [...new Set(loaded)] };
}

// ─── Config Reader ───────────────────────────────────────────────

function readConfig(configPath: string): CoreBlowConfig | null {
    try {
        if (!fs.existsSync(configPath)) return null;
        const raw = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(raw) as CoreBlowConfig;
    } catch (err) {
        log.error({ err: err instanceof Error ? err.message : String(err) },
            'Failed to read config');
        return null;
    }
}

// ─── Helpers ─────────────────────────────────────────────────────

function maskKey(key: string): string {
    if (!key || key.length < 12) return '***';
    return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

/**
 * Resolve the CoreBlow config file path.
 * Priority: COREBLOW_CONFIG env → ~/.coreblow/config.json
 */
export function resolveConfigPath(): string {
    const envPath = process.env.COREBLOW_CONFIG?.trim();
    if (envPath && fs.existsSync(envPath)) return envPath;
    return path.join(process.env.HOME ?? '/tmp', '.coreblow', 'config.json');
}
