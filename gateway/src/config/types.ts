/**
 * CoreBlow — Config Types
 *
 * Core TypeScript types for the entire config tree.
 * Covers gateway, agent, providers, channels, and all subsystems.
 *
 * @packageDocumentation
 */

// ─── Provider Types ────────────────────────────────────────

export type ProviderId = 'openai' | 'anthropic' | 'google' | 'deepseek' | 'ollama' | 'groq' | 'mistral' | 'openrouter' | 'together' | 'fireworks' | 'cohere' | 'perplexity' | string;

export interface ProviderConfig {
    apiKey?: string;
    baseUrl?: string;
    timeout?: number;
    maxRetries?: number;
    headers?: Record<string, string>;
    organizationId?: string;
}

// ─── Channel Types ─────────────────────────────────────────

export type ChannelType = 'discord' | 'telegram' | 'slack' | 'whatsapp' | 'signal' | 'webchat' | 'matrix' | 'irc' | 'msteams' | 'webhook' | string;

export interface ChannelConfig {
    enabled: boolean;
    token?: string;
    apiKey?: string;
    webhookUrl?: string;
    prefix?: string;
    autoReply?: boolean;
    allowedUsers?: string[];
    blockedUsers?: string[];
    metadata?: Record<string, unknown>;
}

// ─── Agent Types ───────────────────────────────────────────

export interface AgentConfig {
    systemPrompt: string;
    maxContextTokens: number;
    maxOutputTokens: number;
    temperature: number;
    topP?: number;
    presencePenalty?: number;
    frequencyPenalty?: number;
    maxTurnsPerSession?: number;
    streamByDefault?: boolean;
    thinkingEnabled?: boolean;
    tools?: string[];
    skills?: string[];
}

// ─── Gateway Types ─────────────────────────────────────────

export interface GatewayConfig {
    port: number;
    host: string;
    corsOrigins?: string[];
    maxRequestBodySize?: string;
    shutdownGracePeriod?: number;
    healthCheckInterval?: number;
    sessionTTL?: number;
    maxSessionsPerUser?: number;
    tlsCert?: string;
    tlsKey?: string;
}

// ─── Logging Types ─────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFormat = 'json' | 'text' | 'pretty';

export interface LoggingConfig {
    level: LogLevel;
    format: LogFormat;
    maxFileSize?: string;
    maxFiles?: number;
    directory?: string;
}

// ─── Security Types ────────────────────────────────────────

export interface SecurityConfig {
    maxInputLength: number;
    rateLimitWindow: number;
    rateLimitMax: number;
    enablePiiScanning: boolean;
    enableGuardrails: boolean;
    allowedIps?: string[];
    blockedIps?: string[];
}

// ─── Cron Types ────────────────────────────────────────────

export interface CronConfig {
    enabled: boolean;
    timezone: string;
    maxConcurrentJobs: number;
}

// ─── Plugin Types ──────────────────────────────────────────

export interface PluginConfig {
    autoEnable: boolean;
    sandboxed: boolean;
    maxPlugins: number;
    registry?: string;
}

// ─── MCP Types ─────────────────────────────────────────────

export interface McpServerConfig {
    name: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
    enabled: boolean;
}

export interface McpConfig {
    servers: McpServerConfig[];
}

// ─── Memory Types ──────────────────────────────────────────

export interface MemoryConfig {
    enabled: boolean;
    backend: 'file' | 'sqlite' | 'redis';
    maxEntries: number;
    ttl?: number;
}

// ─── Tools Types ───────────────────────────────────────────

export interface ToolsConfig {
    webSearch?: { enabled: boolean; provider?: string; apiKey?: string };
    codeExec?: { enabled: boolean; sandboxed?: boolean; timeout?: number };
    fileAccess?: { enabled: boolean; allowedPaths?: string[] };
}

// ─── Master Config ─────────────────────────────────────────

export interface CoreBlowConfig {
    $schema?: string;
    version: number;
    provider: ProviderId;
    model: string;
    gateway: GatewayConfig;
    agent: AgentConfig;
    providers: Record<ProviderId, ProviderConfig>;
    channels: Record<ChannelType, ChannelConfig>;
    logging?: LoggingConfig;
    security?: SecurityConfig;
    cron?: CronConfig;
    plugins?: PluginConfig;
    mcp?: McpConfig;
    memory?: MemoryConfig;
    tools?: ToolsConfig;
}
