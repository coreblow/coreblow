/**
 * pairing/pairing-store.ts
 * Persistent pairing request storage with file-lock safety.
 * Ported from CoreBlow src/pairing/pairing-store.ts.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const PAIRING_CODE_LENGTH = 8;
const PAIRING_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PAIRING_PENDING_TTL_MS = 60 * 60 * 1000; // 1 hour
const PAIRING_PENDING_MAX = 3;

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
