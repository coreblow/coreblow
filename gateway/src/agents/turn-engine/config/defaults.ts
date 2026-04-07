/**
 * CoreBlow Config — Defaults
 *
 * CoreBlow equivalent: config/defaults.ts + config/port-defaults.ts + config/talk-defaults.ts
 *                    + config/agent-limits.ts + config/doc-baseline.ts
 * Default configuration values.
 */

import type { CoreBlowConfig, AgentConfig, GatewayConfig, SandboxConfig, ModelsConfig } from './types.js';

// ── Agent Defaults ───────────────────────────────────────────────────────

export const DEFAULT_AGENT_CONFIG: Required<Pick<AgentConfig, 'temperature' | 'maxTokens' | 'timeout' | 'maxTurns' | 'autoCompact' | 'compactThreshold'>> = {
    temperature: 0.7,
    maxTokens: 8192,
    timeout: 300,
    maxTurns: 25,
    autoCompact: true,
    compactThreshold: 0.8,
};

export const AGENT_LIMITS = {
    maxContextWindow: 2_000_000,
    maxOutputTokens: 32_768,
    maxSystemPromptLength: 100_000,
    maxTurns: 100,
    maxTimeoutSeconds: 3600,
    minTemperature: 0,
    maxTemperature: 2,
};

// ── Gateway Defaults ─────────────────────────────────────────────────────

export const DEFAULT_GATEWAY_CONFIG: Required<Pick<GatewayConfig, 'port' | 'host'>> = {
    port: 3577,
    host: '127.0.0.1',
};

// ── Sandbox Defaults ─────────────────────────────────────────────────────

export const DEFAULT_SANDBOX_CONFIG: Required<Pick<SandboxConfig, 'mode' | 'image' | 'network' | 'cpus' | 'memoryMb' | 'idleTimeoutHours' | 'maxAgeDays'>> = {
    mode: 'off',
    image: 'coreblow/sandbox:latest',
    network: 'none',
    cpus: 2,
    memoryMb: 2048,
    idleTimeoutHours: 4,
    maxAgeDays: 7,
};

// ── Models Defaults ──────────────────────────────────────────────────────

export const DEFAULT_MODELS_CONFIG: Partial<ModelsConfig> = {
    default: 'anthropic/claude-sonnet-4-20250514',
    aliases: {
        'sonnet': 'anthropic/claude-sonnet-4-20250514',
        'opus': 'anthropic/claude-opus-4-20250514',
        'haiku': 'anthropic/claude-3-5-haiku-latest',
        'gpt4': 'openai/gpt-4o',
        'gemini': 'google/gemini-2.5-flash',
    },
};

// ── Full Default Config ──────────────────────────────────────────────────

export function createDefaultConfig(): CoreBlowConfig {
    return {
        version: '1.0',
        agents: {
            defaults: {
                temperature: DEFAULT_AGENT_CONFIG.temperature,
                maxTokens: DEFAULT_AGENT_CONFIG.maxTokens,
                timeout: DEFAULT_AGENT_CONFIG.timeout,
                maxTurns: DEFAULT_AGENT_CONFIG.maxTurns,
                autoCompact: DEFAULT_AGENT_CONFIG.autoCompact,
            },
        },
        models: DEFAULT_MODELS_CONFIG,
        gateway: DEFAULT_GATEWAY_CONFIG,
        sandbox: DEFAULT_SANDBOX_CONFIG,
        logging: { level: 'info', format: 'text' },
    };
}
