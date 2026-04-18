/**
 * CoreBlow — Config Validation
 *
 * Runtime validation for CoreBlow configuration.
 * Catches invalid values before they hit the runtime.
 *
 * @packageDocumentation
 */

import type { CoreBlowConfig, ProviderId } from './types.js';

export interface ValidationIssue {
    path: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    fix?: string;
}

const VALID_PROVIDERS: ProviderId[] = [
    'openai', 'anthropic', 'google', 'deepseek', 'ollama',
    'groq', 'mistral', 'openrouter', 'together', 'fireworks',
    'cohere', 'perplexity',
];

const VALID_CHANNELS = [
    'discord', 'telegram', 'slack', 'whatsapp', 'signal',
    'webchat', 'matrix', 'irc', 'msteams', 'webhook',
];

/**
 * Validate the entire config tree.
 */
export function validateConfig(config: Partial<CoreBlowConfig>): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // ── version ──────────────────────────────────────────────
    if (config.version !== undefined && config.version !== 1) {
        issues.push({
            path: 'version',
            severity: 'warning',
            message: `Unknown config version ${config.version}. Expected 1.`,
        });
    }

    // ── provider ─────────────────────────────────────────────
    if (config.provider) {
        if (!VALID_PROVIDERS.includes(config.provider)) {
            issues.push({
                path: 'provider',
                severity: 'warning',
                message: `Unknown provider "${config.provider}". Known: ${VALID_PROVIDERS.join(', ')}`,
            });
        }
    } else {
        issues.push({
            path: 'provider',
            severity: 'error',
            message: 'No provider configured.',
            fix: 'Run: coreblow configure',
        });
    }

    // ── model ────────────────────────────────────────────────
    if (!config.model) {
        issues.push({
            path: 'model',
            severity: 'error',
            message: 'No model specified.',
            fix: 'Run: coreblow configure',
        });
    }

    // ── gateway ──────────────────────────────────────────────
    if (config.gateway) {
        const gw = config.gateway;
        if (gw.port !== undefined) {
            if (gw.port < 1 || gw.port > 65535) {
                issues.push({ path: 'gateway.port', severity: 'error', message: `Invalid port ${gw.port} (must be 1–65535)` });
            }
            if (gw.port < 1024) {
                issues.push({ path: 'gateway.port', severity: 'warning', message: `Port ${gw.port} requires elevated privileges` });
            }
        }

        if (gw.maxSessionsPerUser !== undefined && gw.maxSessionsPerUser < 1) {
            issues.push({ path: 'gateway.maxSessionsPerUser', severity: 'error', message: 'Must be ≥ 1' });
        }
    }

    // ── agent ────────────────────────────────────────────────
    if (config.agent) {
        const a = config.agent;
        if (a.temperature !== undefined && (a.temperature < 0 || a.temperature > 2)) {
            issues.push({ path: 'agent.temperature', severity: 'error', message: `Temperature ${a.temperature} out of range (0–2)` });
        }
        if (a.maxOutputTokens !== undefined && a.maxOutputTokens < 1) {
            issues.push({ path: 'agent.maxOutputTokens', severity: 'error', message: 'Must be ≥ 1' });
        }
        if (a.maxContextTokens !== undefined && a.maxContextTokens < 1024) {
            issues.push({ path: 'agent.maxContextTokens', severity: 'warning', message: 'Very low context window' });
        }
    }

    // ── providers auth ───────────────────────────────────────
    if (config.provider && config.provider !== 'ollama' && config.providers) {
        const providerCfg = config.providers[config.provider];
        if (!providerCfg?.apiKey) {
            issues.push({
                path: `providers.${config.provider}.apiKey`,
                severity: 'error',
                message: `API key missing for ${config.provider}.`,
                fix: `Run: coreblow auth set ${config.provider} <key>`,
            });
        }
    }

    // ── channels ─────────────────────────────────────────────
    if (config.channels) {
        for (const [name, ch] of Object.entries(config.channels)) {
            if (!VALID_CHANNELS.includes(name)) {
                issues.push({ path: `channels.${name}`, severity: 'info', message: `Custom channel type: ${name}` });
            }
            if (ch.enabled && !ch.token && !ch.apiKey && name !== 'webchat' && name !== 'webhook') {
                issues.push({
                    path: `channels.${name}`,
                    severity: 'warning',
                    message: `Channel "${name}" enabled without token/apiKey`,
                });
            }
        }
    }

    // ── security ─────────────────────────────────────────────
    if (config.security) {
        if (config.security.maxInputLength !== undefined && config.security.maxInputLength > 100_000) {
            issues.push({ path: 'security.maxInputLength', severity: 'warning', message: 'Very high max input length — potential DoS risk' });
        }
    }

    return issues;
}

/**
 * Check if config is valid (no errors).
 */
export function isConfigValid(config: Partial<CoreBlowConfig>): boolean {
    return validateConfig(config).filter(i => i.severity === 'error').length === 0;
}
