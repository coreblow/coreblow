/**
 * src/gateway/config.ts
 * Configuration loader with hot-reload support
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('config');

export interface GatewayConfig {
    // Gateway
    host: string;
    port: number;
    token: string;

    // Agent defaults
    agent: {
        model: string;
        provider: string;
        workspace: string;
        maxTokens: number;
        temperature: number;
    };

    // Providers
    providers: {
        ollama?: { baseUrl: string };
        openai?: { apiKey: string; baseUrl?: string };
        anthropic?: { apiKey: string };
        openrouter?: { apiKey: string };
    };

    // Channels
    channels: {
        telegram?: { token: string };
        discord?: { token: string };
        webchat?: { enabled: boolean };
    };

    // Features
    features: {
        dashboard: boolean;
        cron: boolean;
        audit: boolean;
    };
}

const DEFAULT_CONFIG: GatewayConfig = {
    host: '127.0.0.1',
    port: 3120,
    token: '',

    agent: {
        model: 'llama3.2',
        provider: 'ollama',
        workspace: path.join(os.homedir(), 'coreblow-workspace'),
        maxTokens: 4096,
        temperature: 0.7,
    },

    providers: {
        ollama: { baseUrl: 'http://127.0.0.1:11434' },
    },

    channels: {
        webchat: { enabled: true },
    },

    features: {
        dashboard: true,
        cron: true,
        audit: true,
    },
};

let currentConfig: GatewayConfig = { ...DEFAULT_CONFIG };
let configWatcher: fs.FSWatcher | null = null;

export function getHomeDir(): string {
    return process.env.COREBLOW_HOME || path.join(os.homedir(), '.coreblow');
}

export function getConfigPath(): string {
    return process.env.COREBLOW_CONFIG_PATH || path.join(getHomeDir(), 'config.json');
}

export function loadConfig(): GatewayConfig {
    const homeDir = getHomeDir();
    const configPath = getConfigPath();

    // Ensure home directory exists
    fs.mkdirSync(homeDir, { recursive: true });

    // Create default config if not exists
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
        log.info({ path: configPath }, 'Created default config file');
    }

    try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        const fileConfig = JSON.parse(raw);

        // Deep merge with defaults
        currentConfig = deepMerge(DEFAULT_CONFIG, fileConfig);

        // Override from env vars
        if (process.env.COREBLOW_TOKEN) currentConfig.token = process.env.COREBLOW_TOKEN;
        if (process.env.COREBLOW_PORT) currentConfig.port = parseInt(process.env.COREBLOW_PORT);
        if (process.env.OPENAI_API_KEY) {
            currentConfig.providers.openai = { apiKey: process.env.OPENAI_API_KEY, ...currentConfig.providers.openai };
        }
        if (process.env.ANTHROPIC_API_KEY) {
            currentConfig.providers.anthropic = { apiKey: process.env.ANTHROPIC_API_KEY };
        }

        log.info({ path: configPath }, 'Config loaded');
    } catch (err) {
        log.error({ err }, 'Failed to load config, using defaults');
        currentConfig = { ...DEFAULT_CONFIG };
    }

    return currentConfig;
}

export function getConfig(): GatewayConfig {
    return currentConfig;
}

export function watchConfig(onChange: (config: GatewayConfig) => void) {
    const configPath = getConfigPath();

    if (configWatcher) configWatcher.close();

    configWatcher = fs.watch(configPath, (event) => {
        if (event === 'change') {
            log.info('Config file changed, reloading...');
            try {
                const newConfig = loadConfig();
                onChange(newConfig);
            } catch (err) {
                log.error({ err }, 'Failed to reload config');
            }
        }
    });

    log.debug('Config hot-reload watcher active');
}

function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
    const result = { ...target };
    for (const key of Object.keys(source) as (keyof T)[]) {
        const srcVal = source[key];
        const tgtVal = target[key];
        if (srcVal && typeof srcVal === 'object' && !Array.isArray(srcVal) && tgtVal && typeof tgtVal === 'object') {
            (result as any)[key] = deepMerge(tgtVal as any, srcVal as any);
        } else if (srcVal !== undefined) {
            (result as any)[key] = srcVal;
        }
    }
    return result;
}
