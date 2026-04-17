/**
 * agents/auth-health.ts
 * Auth credential health monitoring for providers.
 * Ported from CoreBlow reference src/agents/auth-health.ts (287 LOC).
 */

import { normalizeProviderId } from './provider-id.js';

export type AuthProfileSource = 'store';
export type AuthProfileHealthStatus = 'ok' | 'expiring' | 'expired' | 'missing' | 'static';
export type AuthCredentialType = 'oauth' | 'token' | 'api_key';

export interface AuthProfileHealth {
    profileId: string;
    provider: string;
    type: AuthCredentialType;
    status: AuthProfileHealthStatus;
    expiresAt?: number;
    remainingMs?: number;
    source: AuthProfileSource;
    label: string;
}

export interface AuthProviderHealth {
    provider: string;
    status: AuthProfileHealthStatus;
    expiresAt?: number;
    remainingMs?: number;
    profiles: AuthProfileHealth[];
}

export interface AuthHealthSummary {
    now: number;
    warnAfterMs: number;
    profiles: AuthProfileHealth[];
    providers: AuthProviderHealth[];
}

export interface AuthCredential {
    provider: string;
    type: AuthCredentialType;
    expires?: number;
    refresh?: string;
    label?: string;
}

export interface AuthProfileStore {
    profiles: Record<string, AuthCredential>;
}

export const DEFAULT_OAUTH_WARN_MS = 24 * 60 * 60 * 1000;

export function formatRemainingShort(remainingMs?: number): string {
    if (remainingMs === undefined || Number.isNaN(remainingMs)) return 'unknown';
    if (remainingMs <= 0) return '0m';
    const minutes = Math.round(remainingMs / 60_000);
    if (minutes < 1) return '1m';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours}h`;
    return `${Math.round(hours / 24)}d`;
}

function resolveOAuthStatus(expiresAt: number | undefined, now: number, warnAfterMs: number): { status: AuthProfileHealthStatus; remainingMs?: number } {
    if (!expiresAt || !Number.isFinite(expiresAt) || expiresAt <= 0) return { status: 'missing' };
    const remainingMs = expiresAt - now;
    if (remainingMs <= 0) return { status: 'expired', remainingMs };
    if (remainingMs <= warnAfterMs) return { status: 'expiring', remainingMs };
    return { status: 'ok', remainingMs };
}

function buildProfileHealth(profileId: string, credential: AuthCredential, now: number, warnAfterMs: number): AuthProfileHealth {
    const provider = normalizeProviderId(credential.provider);
    const label = credential.label ?? profileId;
    const source: AuthProfileSource = 'store';

    if (credential.type === 'api_key') {
        return { profileId, provider, type: 'api_key', status: 'static', source, label };
    }

    if (credential.type === 'token') {
        if (!credential.expires) return { profileId, provider, type: 'token', status: 'static', source, label };
        const { status, remainingMs } = resolveOAuthStatus(credential.expires, now, warnAfterMs);
        return { profileId, provider, type: 'token', status, expiresAt: credential.expires, remainingMs, source, label };
    }

    // OAuth
    const hasRefresh = typeof credential.refresh === 'string' && credential.refresh.length > 0;
    const { status: rawStatus, remainingMs } = resolveOAuthStatus(credential.expires, now, warnAfterMs);
    const status = hasRefresh && (rawStatus === 'expired' || rawStatus === 'expiring') ? 'ok' : rawStatus;
    return { profileId, provider, type: 'oauth', status, expiresAt: credential.expires, remainingMs, source, label };
}

export function buildAuthHealthSummary(params: {
    store: AuthProfileStore;
    warnAfterMs?: number;
    providers?: string[];
}): AuthHealthSummary {
    const now = Date.now();
    const warnAfterMs = params.warnAfterMs ?? DEFAULT_OAUTH_WARN_MS;
    const providerFilter = params.providers ? new Set(params.providers.map((p) => normalizeProviderId(p))) : null;

    const profiles = Object.entries(params.store.profiles)
        .filter(([, cred]) => providerFilter ? providerFilter.has(normalizeProviderId(cred.provider)) : true)
        .map(([id, cred]) => buildProfileHealth(id, cred, now, warnAfterMs))
        .sort((a, b) => a.provider.localeCompare(b.provider) || a.profileId.localeCompare(b.profileId));

    const providersMap = new Map<string, AuthProviderHealth>();
    for (const profile of profiles) {
        const existing = providersMap.get(profile.provider);
        if (!existing) providersMap.set(profile.provider, { provider: profile.provider, status: 'missing', profiles: [profile] });
        else existing.profiles.push(profile);
    }

    if (providerFilter) {
        for (const provider of providerFilter) {
            if (!providersMap.has(provider)) providersMap.set(provider, { provider, status: 'missing', profiles: [] });
        }
    }

    for (const prov of providersMap.values()) {
        if (prov.profiles.length === 0) { prov.status = 'missing'; continue; }
        const expirable = prov.profiles.filter((p) => p.type === 'oauth' || p.type === 'token');
        const apiKeys = prov.profiles.filter((p) => p.type === 'api_key');
        if (expirable.length === 0) { prov.status = apiKeys.length > 0 ? 'static' : 'missing'; continue; }
        const expiries = expirable.map((p) => p.expiresAt).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
        if (expiries.length > 0) { prov.expiresAt = Math.min(...expiries); prov.remainingMs = prov.expiresAt - now; }
        const statuses = new Set(expirable.map((p) => p.status));
        if (statuses.has('expired') || statuses.has('missing')) prov.status = 'expired';
        else if (statuses.has('expiring')) prov.status = 'expiring';
        else prov.status = 'ok';
    }

    const providers = [...providersMap.values()].sort((a, b) => a.provider.localeCompare(b.provider));
    return { now, warnAfterMs, profiles, providers };
}

export function formatAuthHealthSummary(summary: AuthHealthSummary): string {
    if (summary.profiles.length === 0) return 'No auth profiles configured.';
    const lines: string[] = [];
    for (const prov of summary.providers) {
        const icon = prov.status === 'ok' || prov.status === 'static' ? '✅' : prov.status === 'expiring' ? '⚠️' : '❌';
        const remain = prov.remainingMs !== undefined ? ` (${formatRemainingShort(prov.remainingMs)})` : '';
        lines.push(`${icon} ${prov.provider}: ${prov.status}${remain} — ${prov.profiles.length} profile(s)`);
    }
    return lines.join('\n');
}
