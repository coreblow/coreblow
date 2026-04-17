/**
 * secrets/types.ts
 * Core type definitions for CoreBlow secrets engine.
 * Ported from CoreBlow reference's secrets subsystem with CoreBlow OOP compression.
 */

// ─── Secret Reference ─────────────────────────────────────────────
export type SecretRefSource = 'env' | 'file' | 'exec';

export interface SecretRef {
    source: SecretRefSource;
    provider: string;
    id: string;
}

// ─── Provider Configs ─────────────────────────────────────────────
export interface EnvSecretProviderConfig {
    source: 'env';
    allowlist?: string[];
}

export interface FileSecretProviderConfig {
    source: 'file';
    path: string;
    mode?: 'json' | 'singleValue';
    timeoutMs?: number;
    maxBytes?: number;
    allowInsecurePath?: boolean;
    allowSymlinkPath?: boolean;
    trustedDirs?: string[];
    allowReadableByOthers?: boolean;
}

export interface ExecSecretProviderConfig {
    source: 'exec';
    command: string;
    args?: string[];
    env?: Record<string, string>;
    passEnv?: string[];
    timeoutMs?: number;
    noOutputTimeoutMs?: number;
    maxOutputBytes?: number;
    jsonOnly?: boolean;
    trustedDirs?: string[];
    allowInsecurePath?: boolean;
    allowSymlinkCommand?: boolean;
}

export type SecretProviderConfig =
    | EnvSecretProviderConfig
    | FileSecretProviderConfig
    | ExecSecretProviderConfig;

// ─── Resolution ───────────────────────────────────────────────────
export interface SecretRefResolveCache {
    resolvedByRefKey?: Map<string, Promise<unknown>>;
    filePayloadByProvider?: Map<string, Promise<unknown>>;
}

export interface ResolutionLimits {
    maxProviderConcurrency: number;
    maxRefsPerProvider: number;
    maxBatchBytes: number;
}

export interface ResolveSecretRefOptions {
    config: Record<string, unknown>;
    env?: NodeJS.ProcessEnv;
    cache?: SecretRefResolveCache;
}

export type ProviderResolutionOutput = Map<string, unknown>;

// ─── Audit ────────────────────────────────────────────────────────
export type AuditSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface SecretAuditEntry {
    severity: AuditSeverity;
    code: string;
    message: string;
    path?: string;
    recommendation?: string;
}

export interface SecretAuditReport {
    timestamp: number;
    entries: SecretAuditEntry[];
    summary: {
        critical: number;
        high: number;
        medium: number;
        low: number;
        info: number;
    };
}

// ─── Exec Protocol ────────────────────────────────────────────────
export interface ExecSecretRequest {
    protocolVersion: 1;
    provider: string;
    ids: string[];
}

export interface ExecSecretResponse {
    protocolVersion: 1;
    values: Record<string, unknown>;
    errors?: Record<string, { message: string }>;
}

// ─── Apply ────────────────────────────────────────────────────────
export interface SecretApplyResult {
    applied: number;
    skipped: number;
    errors: Array<{ path: string; error: string }>;
}
