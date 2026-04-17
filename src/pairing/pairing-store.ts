/**
 * pairing/pairing-store.ts — CoreBlow Pairing Store
 * Original CoreBlow implementation with channel-scoped storage,
 * stat-based read caching, and file-lock safety.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getPairingAdapter } from '../channels/plugins/pairing.js';
import type { ChannelId } from '../channels/plugins/types.js';
import { resolveOAuthDir } from '../config/paths.js';
import type { FileLockOptions } from '../infra/file-lock.js';
import { withFileLock } from '../infra/file-lock.js';
import { readJsonFileWithFallback, writeJsonFileAtomically } from '../plugin-sdk/json-store.js';
import { DEFAULT_ACCOUNT_ID } from '../routing/session-key.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const PAIRING_CODE_LENGTH = 8;
const PAIRING_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PAIRING_PENDING_TTL_MS = 60 * 60 * 1000; // 1 hour
const PAIRING_PENDING_MAX = 3;

const CHANNEL_LOCK_OPTIONS: FileLockOptions = {
    retries: {
        retries: 10,
        factor: 2,
        minTimeout: 100,
        maxTimeout: 10_000,
        randomize: true,
    },
    stale: 30_000,
};

// ─── Types ───────────────────────────────────────────────────────────────────

export type PairingChannel = ChannelId;

export type PairingRequest = {
    id: string;
    code: string;
    createdAt: string;
    lastSeenAt: string;
    meta?: Record<string, string>;
};

type PairingStoreData = {
    version: 1;
    requests: PairingRequest[];
};

type AllowFromData = {
    version: 1;
    allowFrom: string[];
};

type AllowFromCacheEntry = {
    exists: boolean;
    mtimeMs: number | null;
    size: number | null;
    entries: string[];
};

// ─── Module-level Cache ──────────────────────────────────────────────────────

const allowFromReadCache = new Map<string, AllowFromCacheEntry>();

/** Clear the allow-from read cache (for testing only). */
export function clearAllowFromCacheForTest(): void {
    allowFromReadCache.clear();
}

// ─── Safety Utilities ────────────────────────────────────────────────────────

/** Sanitize a channel ID for safe use in filenames (prevent path traversal). */
function sanitizeChannelKey(channel: PairingChannel): string {
    const raw = String(channel).trim().toLowerCase();
    if (!raw) throw new Error('Invalid pairing channel');
    const safe = raw.replace(/[\\/:*?"<>|]/g, '_').replace(/\.\./g, '_');
    if (!safe || safe === '_') throw new Error('Invalid pairing channel');
    return safe;
}

/** Sanitize an account ID for safe use in filenames. */
function sanitizeAccountKey(accountId: string): string {
    const raw = String(accountId).trim().toLowerCase();
    if (!raw) throw new Error('Invalid pairing account id');
    const safe = raw.replace(/[\\/:*?"<>|]/g, '_').replace(/\.\./g, '_');
    if (!safe || safe === '_') throw new Error('Invalid pairing account id');
    return safe;
}

/**
 * Generate a human-readable pairing code (no ambiguous chars).
 */
export function generatePairingCode(length = PAIRING_CODE_LENGTH): string {
    const bytes = crypto.randomBytes(length);
    let code = '';
    for (let i = 0; i < length; i++) {
        code += PAIRING_CODE_ALPHABET[bytes[i] % PAIRING_CODE_ALPHABET.length];
    }
    return code;
}

/** Generate a unique code that doesn't collide with existing codes. */
function generateUniqueCode(existingCodes: Set<string>): string {
    for (let attempt = 0; attempt < 500; attempt++) {
        const code = generatePairingCode();
        if (!existingCodes.has(code)) return code;
    }
    throw new Error('Failed to generate unique pairing code');
}

/** Deduplicate a string array while preserving insertion order. */
function deduplicatePreserveOrder(entries: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const entry of entries) {
        const normalized = String(entry).trim();
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        result.push(normalized);
    }
    return result;
}

/** Normalize an allow-from entry using the channel's pairing adapter (if available). */
function normalizeAllowEntry(channel: PairingChannel, entry: string): string {
    const trimmed = entry.trim();
    if (!trimmed || trimmed === '*') return '';
    const adapter = getPairingAdapter(channel);
    const normalized = adapter?.normalizeAllowEntry ? adapter.normalizeAllowEntry(trimmed) : trimmed;
    return String(normalized).trim();
}

/** Normalize a full allow-from list via the channel adapter. */
function normalizeAllowFromList(channel: PairingChannel, data: AllowFromData): string[] {
    const list = Array.isArray(data.allowFrom) ? data.allowFrom : [];
    return deduplicatePreserveOrder(
        list.map((v) => normalizeAllowEntry(channel, String(v))).filter(Boolean),
    );
}

function normalizeAccountId(accountId?: string): string {
    return accountId?.trim().toLowerCase() || '';
}

// ─── Timestamp & Pruning Helpers ─────────────────────────────────────────────

function parseTimestamp(value: string | undefined): number | null {
    if (!value) return null;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function isRequestExpired(entry: PairingRequest, nowMs: number): boolean {
    const createdAt = parseTimestamp(entry.createdAt);
    return !createdAt || nowMs - createdAt > PAIRING_PENDING_TTL_MS;
}

function pruneExpiredRequests(requests: PairingRequest[], nowMs: number) {
    const kept: PairingRequest[] = [];
    let removed = false;
    for (const req of requests) {
        if (isRequestExpired(req, nowMs)) { removed = true; continue; }
        kept.push(req);
    }
    return { requests: kept, removed };
}

function pruneExcessRequests(requests: PairingRequest[], maxPending: number) {
    if (maxPending <= 0 || requests.length <= maxPending) {
        return { requests, removed: false };
    }
    const sorted = requests.slice().sort((a, b) => {
        const aTime = parseTimestamp(a.lastSeenAt) ?? parseTimestamp(a.createdAt) ?? 0;
        const bTime = parseTimestamp(b.lastSeenAt) ?? parseTimestamp(b.createdAt) ?? 0;
        return aTime - bTime;
    });
    return { requests: sorted.slice(-maxPending), removed: true };
}

function requestMatchesAccount(entry: PairingRequest, normalizedId: string): boolean {
    if (!normalizedId) return true;
    return String(entry.meta?.accountId ?? '').trim().toLowerCase() === normalizedId;
}

// ─── Channel Path Resolution ─────────────────────────────────────────────────

function resolveCredentialsDir(env: NodeJS.ProcessEnv = process.env): string {
    return resolveOAuthDir(env);
}

function resolveChannelPairingPath(channel: PairingChannel, env: NodeJS.ProcessEnv = process.env): string {
    return path.join(resolveCredentialsDir(env), `${sanitizeChannelKey(channel)}-pairing.json`);
}

/** Resolve the file path for a channel's allow-from store. */
export function resolveChannelAllowFromPath(
    channel: PairingChannel,
    env: NodeJS.ProcessEnv = process.env,
    accountId?: string,
): string {
    const base = sanitizeChannelKey(channel);
    const normalizedAccount = typeof accountId === 'string' ? accountId.trim() : '';
    if (!normalizedAccount) {
        return path.join(resolveCredentialsDir(env), `${base}-allowFrom.json`);
    }
    return path.join(
        resolveCredentialsDir(env),
        `${base}-${sanitizeAccountKey(normalizedAccount)}-allowFrom.json`,
    );
}

// ─── Stat-Based Cache ────────────────────────────────────────────────────────

function cloneCacheEntry(entry: AllowFromCacheEntry): AllowFromCacheEntry {
    return { exists: entry.exists, mtimeMs: entry.mtimeMs, size: entry.size, entries: entry.entries.slice() };
}

function checkCacheHit(filePath: string, exists: boolean, mtimeMs: number | null, size: number | null): AllowFromCacheEntry | null {
    const cached = allowFromReadCache.get(filePath);
    if (!cached) return null;
    if (cached.exists !== exists) return null;
    if (!exists) return cloneCacheEntry(cached);
    if (cached.mtimeMs !== mtimeMs || cached.size !== size) return null;
    return cloneCacheEntry(cached);
}

function updateCache(filePath: string, entry: AllowFromCacheEntry): void {
    allowFromReadCache.set(filePath, cloneCacheEntry(entry));
}

// ─── Allow-From File I/O ─────────────────────────────────────────────────────

function readAllowFromFileSync(channel: PairingChannel, filePath: string): { entries: string[]; exists: boolean } {
    let stat: fs.Stats | null = null;
    try { stat = fs.statSync(filePath); }
    catch (err) { if ((err as { code?: string }).code !== 'ENOENT') return { entries: [], exists: false }; }

    const hit = checkCacheHit(filePath, Boolean(stat), stat?.mtimeMs ?? null, stat?.size ?? null);
    if (hit) return { entries: hit.entries, exists: hit.exists };
    if (!stat) {
        updateCache(filePath, { exists: false, mtimeMs: null, size: null, entries: [] });
        return { entries: [], exists: false };
    }

    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw) as AllowFromData;
        const entries = normalizeAllowFromList(channel, parsed);
        updateCache(filePath, { exists: true, mtimeMs: stat.mtimeMs, size: stat.size, entries });
        return { entries, exists: true };
    } catch {
        updateCache(filePath, { exists: true, mtimeMs: stat.mtimeMs, size: stat.size, entries: [] });
        return { entries: [], exists: true };
    }
}

async function readAllowFromFileAsync(channel: PairingChannel, filePath: string): Promise<{ entries: string[]; exists: boolean }> {
    let stat: fs.Stats | null = null;
    try { stat = await fs.promises.stat(filePath); }
    catch (err) { if ((err as { code?: string }).code !== 'ENOENT') throw err; }

    const hit = checkCacheHit(filePath, Boolean(stat), stat?.mtimeMs ?? null, stat?.size ?? null);
    if (hit) return { entries: hit.entries, exists: hit.exists };
    if (!stat) {
        updateCache(filePath, { exists: false, mtimeMs: null, size: null, entries: [] });
        return { entries: [], exists: false };
    }

    const { value, exists } = await readJsonFileWithFallback<AllowFromData>(filePath, { version: 1, allowFrom: [] });
    const entries = normalizeAllowFromList(channel, value);
    updateCache(filePath, { exists, mtimeMs: stat.mtimeMs, size: stat.size, entries });
    return { entries, exists };
}

async function writeAllowFromFile(filePath: string, allowFrom: string[]): Promise<void> {
    await writeJsonFileAtomically(filePath, { version: 1, allowFrom } as AllowFromData);
    let stat: fs.Stats | null = null;
    try { stat = await fs.promises.stat(filePath); } catch {}
    updateCache(filePath, { exists: true, mtimeMs: stat?.mtimeMs ?? null, size: stat?.size ?? null, entries: allowFrom.slice() });
}

function shouldReadLegacyEntries(normalizedAccount: string): boolean {
    return !normalizedAccount || normalizedAccount === DEFAULT_ACCOUNT_ID;
}

function resolveEffectiveAccountId(accountId?: string): string {
    return normalizeAccountId(accountId) || DEFAULT_ACCOUNT_ID;
}

// ─── File Lock Helper ────────────────────────────────────────────────────────

async function withChannelFileLock<T>(filePath: string, fallbackData: unknown, fn: () => Promise<T>): Promise<T> {
    try { await fs.promises.access(filePath); } catch { await writeJsonFileAtomically(filePath, fallbackData); }
    return await withFileLock(filePath, CHANNEL_LOCK_OPTIONS, fn);
}

// ─── PairingStore Class (Original CB — Preserved) ────────────────────────────

export class PairingStore {
    private storeDir: string;

    constructor(storeDir: string) {
        this.storeDir = storeDir;
        fs.mkdirSync(storeDir, { recursive: true });
    }

    private get storePath(): string { return path.join(this.storeDir, 'pairing-requests.json'); }
    private get allowFromPath(): string { return path.join(this.storeDir, 'allow-from.json'); }

    /**
     * Upsert a pairing request. Returns existing code if within TTL, otherwise creates new.
     */
    async upsert(params: { id: string; meta?: Record<string, string> }): Promise<{ code: string; created: boolean }> {
        const data = this.readStore();
        const now = new Date().toISOString();

        // Prune expired
        data.requests = data.requests.filter((r) => Date.now() - new Date(r.createdAt).getTime() < PAIRING_PENDING_TTL_MS);

        const existing = data.requests.find((r) => r.id === params.id);
        if (existing) {
            existing.lastSeenAt = now;
            this.writeStore(data);
            return { code: existing.code, created: false };
        }

        // Enforce max pending
        if (data.requests.length >= PAIRING_PENDING_MAX) {
            data.requests.shift(); // drop oldest
        }

        const code = generatePairingCode();
        data.requests.push({ id: params.id, code, createdAt: now, lastSeenAt: now, meta: params.meta });
        this.writeStore(data);
        return { code, created: true };
    }

    /**
     * Accept a pairing request by code.
     */
    async accept(code: string): Promise<PairingRequest | null> {
        const data = this.readStore();
        const idx = data.requests.findIndex((r) => r.code === code);
        if (idx < 0) return null;

        const [request] = data.requests.splice(idx, 1);
        this.writeStore(data);

        // Add to allow-from list
        const allow = this.readAllowFrom();
        if (!allow.allowFrom.includes(request.id)) {
            allow.allowFrom.push(request.id);
            this.writeAllowFrom(allow);
        }

        return request;
    }

    /**
     * Reject a pairing request by code.
     */
    async reject(code: string): Promise<PairingRequest | null> {
        const data = this.readStore();
        const idx = data.requests.findIndex((r) => r.code === code);
        if (idx < 0) return null;
        const [request] = data.requests.splice(idx, 1);
        this.writeStore(data);
        return request;
    }

    /**
     * Check if a sender is in the allow-from list.
     */
    isAllowed(senderId: string): boolean {
        const allow = this.readAllowFrom();
        return allow.allowFrom.includes(senderId);
    }

    /**
     * List pending pairing requests.
     */
    listPending(): PairingRequest[] {
        const data = this.readStore();
        return data.requests.filter((r) => Date.now() - new Date(r.createdAt).getTime() < PAIRING_PENDING_TTL_MS);
    }

    /**
     * List allowed sender IDs.
     */
    listAllowed(): string[] {
        return this.readAllowFrom().allowFrom;
    }

    /**
     * Revoke a paired sender.
     */
    revoke(senderId: string): boolean {
        const allow = this.readAllowFrom();
        const idx = allow.allowFrom.indexOf(senderId);
        if (idx < 0) return false;
        allow.allowFrom.splice(idx, 1);
        this.writeAllowFrom(allow);
        return true;
    }

    private readStore(): PairingStoreData {
        try { return JSON.parse(fs.readFileSync(this.storePath, 'utf-8')); }
        catch { return { version: 1, requests: [] }; }
    }

    private writeStore(data: PairingStoreData): void {
        fs.writeFileSync(this.storePath, JSON.stringify(data, null, 2));
    }

    private readAllowFrom(): AllowFromData {
        try { return JSON.parse(fs.readFileSync(this.allowFromPath, 'utf-8')); }
        catch { return { version: 1, allowFrom: [] }; }
    }

    private writeAllowFrom(data: AllowFromData): void {
        fs.writeFileSync(this.allowFromPath, JSON.stringify(data, null, 2));
    }
}

// ─── Channel-Scoped Allow-From (Original CB) ────────────────────────────────

/**
 * Read allow-from entries for a channel synchronously.
 * For the default account, merges scoped and legacy entries for backward compatibility.
 */
export function readChannelAllowFromSync(
    channel: PairingChannel,
    env: NodeJS.ProcessEnv = process.env,
    accountId?: string,
): string[] {
    const effectiveAccount = resolveEffectiveAccountId(accountId);

    if (!shouldReadLegacyEntries(effectiveAccount)) {
        const scopedPath = resolveChannelAllowFromPath(channel, env, effectiveAccount);
        return readAllowFromFileSync(channel, scopedPath).entries;
    }

    const scopedPath = resolveChannelAllowFromPath(channel, env, effectiveAccount);
    const scopedEntries = readAllowFromFileSync(channel, scopedPath).entries;
    const legacyPath = resolveChannelAllowFromPath(channel, env);
    const legacyEntries = readAllowFromFileSync(channel, legacyPath).entries;
    return deduplicatePreserveOrder([...scopedEntries, ...legacyEntries]);
}

/**
 * Read allow-from entries for a channel asynchronously.
 */
export async function readChannelAllowFromAsync(
    channel: PairingChannel,
    env: NodeJS.ProcessEnv = process.env,
    accountId?: string,
): Promise<string[]> {
    const effectiveAccount = resolveEffectiveAccountId(accountId);

    if (!shouldReadLegacyEntries(effectiveAccount)) {
        const scopedPath = resolveChannelAllowFromPath(channel, env, effectiveAccount);
        return (await readAllowFromFileAsync(channel, scopedPath)).entries;
    }

    const scopedPath = resolveChannelAllowFromPath(channel, env, effectiveAccount);
    const scopedEntries = (await readAllowFromFileAsync(channel, scopedPath)).entries;
    const legacyPath = resolveChannelAllowFromPath(channel, env);
    const legacyEntries = (await readAllowFromFileAsync(channel, legacyPath)).entries;
    return deduplicatePreserveOrder([...scopedEntries, ...legacyEntries]);
}

/**
 * Add an entry to a channel's allow-from store (with file-lock safety).
 */
export async function addChannelAllowFromEntry(params: {
    channel: PairingChannel;
    entry: string | number;
    accountId?: string;
    env?: NodeJS.ProcessEnv;
}): Promise<{ changed: boolean; allowFrom: string[] }> {
    const env = params.env ?? process.env;
    const filePath = resolveChannelAllowFromPath(params.channel, env, params.accountId);

    return await withChannelFileLock(filePath, { version: 1, allowFrom: [] } as AllowFromData, async () => {
        const { value } = await readJsonFileWithFallback<AllowFromData>(filePath, { version: 1, allowFrom: [] });
        const current = normalizeAllowFromList(params.channel, value);
        const normalized = normalizeAllowEntry(params.channel, String(params.entry).trim());
        if (!normalized || current.includes(normalized)) {
            return { changed: false, allowFrom: current };
        }
        const next = [...current, normalized];
        await writeAllowFromFile(filePath, next);
        return { changed: true, allowFrom: next };
    });
}

/**
 * Remove an entry from a channel's allow-from store (with file-lock safety).
 */
export async function removeChannelAllowFromEntry(params: {
    channel: PairingChannel;
    entry: string | number;
    accountId?: string;
    env?: NodeJS.ProcessEnv;
}): Promise<{ changed: boolean; allowFrom: string[] }> {
    const env = params.env ?? process.env;
    const filePath = resolveChannelAllowFromPath(params.channel, env, params.accountId);

    return await withChannelFileLock(filePath, { version: 1, allowFrom: [] } as AllowFromData, async () => {
        const { value } = await readJsonFileWithFallback<AllowFromData>(filePath, { version: 1, allowFrom: [] });
        const current = normalizeAllowFromList(params.channel, value);
        const normalized = normalizeAllowEntry(params.channel, String(params.entry).trim());
        if (!normalized) return { changed: false, allowFrom: current };
        const next = current.filter((e) => e !== normalized);
        if (next.length === current.length) return { changed: false, allowFrom: current };
        await writeAllowFromFile(filePath, next);
        return { changed: true, allowFrom: next };
    });
}

// ─── Channel Pairing Request Management (Original CB) ────────────────────────

/**
 * List pending pairing requests for a channel.
 */
export async function listChannelPairingRequests(
    channel: PairingChannel,
    env: NodeJS.ProcessEnv = process.env,
    accountId?: string,
): Promise<PairingRequest[]> {
    const filePath = resolveChannelPairingPath(channel, env);

    return await withChannelFileLock(filePath, { version: 1, requests: [] } as PairingStoreData, async () => {
        const { value } = await readJsonFileWithFallback<PairingStoreData>(filePath, { version: 1, requests: [] });
        const rawRequests = Array.isArray(value.requests) ? value.requests : [];
        const { requests: pruned, removed: expiredRemoved } = pruneExpiredRequests(rawRequests, Date.now());
        const { requests: capped, removed: cappedRemoved } = pruneExcessRequests(pruned, PAIRING_PENDING_MAX);

        if (expiredRemoved || cappedRemoved) {
            await writeJsonFileAtomically(filePath, { version: 1, requests: capped } as PairingStoreData);
        }

        const normalizedId = normalizeAccountId(accountId);
        const filtered = normalizedId
            ? capped.filter((r) => requestMatchesAccount(r, normalizedId))
            : capped;

        return filtered
            .filter((r) => r && typeof r.id === 'string' && typeof r.code === 'string' && typeof r.createdAt === 'string')
            .slice()
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
}

/**
 * Upsert a pairing request for a specific channel (with file-lock safety).
 */
export async function upsertChannelPairingRequest(params: {
    channel: PairingChannel;
    id: string | number;
    accountId: string;
    meta?: Record<string, string | undefined | null>;
    env?: NodeJS.ProcessEnv;
}): Promise<{ code: string; created: boolean }> {
    const env = params.env ?? process.env;
    const filePath = resolveChannelPairingPath(params.channel, env);

    return await withChannelFileLock(filePath, { version: 1, requests: [] } as PairingStoreData, async () => {
        const now = new Date().toISOString();
        const nowMs = Date.now();
        const id = String(params.id).trim();
        const effectiveAccount = normalizeAccountId(params.accountId) || DEFAULT_ACCOUNT_ID;

        const baseMeta = params.meta && typeof params.meta === 'object'
            ? Object.fromEntries(
                  Object.entries(params.meta)
                      .map(([k, v]) => [k, String(v ?? '').trim()] as const)
                      .filter(([, v]) => Boolean(v)),
              )
            : undefined;
        const meta = { ...baseMeta, accountId: effectiveAccount };

        const { value } = await readJsonFileWithFallback<PairingStoreData>(filePath, { version: 1, requests: [] });
        let requests = Array.isArray(value.requests) ? value.requests : [];
        const { requests: afterExpiry } = pruneExpiredRequests(requests, nowMs);
        requests = afterExpiry;

        const existingIdx = requests.findIndex((r) => r.id === id && requestMatchesAccount(r, effectiveAccount));
        const existingCodes = new Set(requests.map((r) => String(r.code ?? '').trim().toUpperCase()));

        if (existingIdx >= 0) {
            const existing = requests[existingIdx];
            const code = (existing?.code?.trim()) || generateUniqueCode(existingCodes);
            requests[existingIdx] = { id, code, createdAt: existing?.createdAt ?? now, lastSeenAt: now, meta: meta ?? existing?.meta };
            const { requests: capped } = pruneExcessRequests(requests, PAIRING_PENDING_MAX);
            await writeJsonFileAtomically(filePath, { version: 1, requests: capped } as PairingStoreData);
            return { code, created: false };
        }

        const { requests: capped } = pruneExcessRequests(requests, PAIRING_PENDING_MAX);
        requests = capped;
        if (PAIRING_PENDING_MAX > 0 && requests.length >= PAIRING_PENDING_MAX) {
            await writeJsonFileAtomically(filePath, { version: 1, requests } as PairingStoreData);
            return { code: '', created: false };
        }

        const code = generateUniqueCode(existingCodes);
        const newRequest: PairingRequest = { id, code, createdAt: now, lastSeenAt: now, ...(meta ? { meta } : {}) };
        await writeJsonFileAtomically(filePath, { version: 1, requests: [...requests, newRequest] } as PairingStoreData);
        return { code, created: true };
    });
}

/**
 * Approve a pairing code for a channel — removes the request and adds to allow-from.
 */
export async function approveChannelPairingCode(params: {
    channel: PairingChannel;
    code: string;
    accountId?: string;
    env?: NodeJS.ProcessEnv;
}): Promise<{ id: string; entry?: PairingRequest } | null> {
    const env = params.env ?? process.env;
    const code = params.code.trim().toUpperCase();
    if (!code) return null;

    const filePath = resolveChannelPairingPath(params.channel, env);

    return await withChannelFileLock(filePath, { version: 1, requests: [] } as PairingStoreData, async () => {
        const { value } = await readJsonFileWithFallback<PairingStoreData>(filePath, { version: 1, requests: [] });
        const rawRequests = Array.isArray(value.requests) ? value.requests : [];
        const { requests: pruned, removed } = pruneExpiredRequests(rawRequests, Date.now());
        const normalizedId = normalizeAccountId(params.accountId);

        const idx = pruned.findIndex((r) => {
            if (String(r.code ?? '').toUpperCase() !== code) return false;
            return requestMatchesAccount(r, normalizedId);
        });

        if (idx < 0) {
            if (removed) await writeJsonFileAtomically(filePath, { version: 1, requests: pruned } as PairingStoreData);
            return null;
        }

        const entry = pruned[idx];
        if (!entry) return null;

        pruned.splice(idx, 1);
        await writeJsonFileAtomically(filePath, { version: 1, requests: pruned } as PairingStoreData);

        const entryAccountId = String(entry.meta?.accountId ?? '').trim() || undefined;
        await addChannelAllowFromEntry({
            channel: params.channel,
            entry: entry.id,
            accountId: params.accountId?.trim() || entryAccountId,
            env,
        });

        return { id: entry.id, entry };
    });
}

// Backwards compatibility alias
export const readChannelAllowFromStore = readChannelAllowFromSync;
export const readChannelAllowFromStoreSync = readChannelAllowFromSync;
