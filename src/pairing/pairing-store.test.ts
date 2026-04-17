/**
 * pairing/pairing-store.test.ts — Pairing store tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PairingStore, generatePairingCode } from './pairing-store.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('Pairing Store', () => {
    let tmpDir: string;
    let store: PairingStore;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pairing-test-'));
        store = new PairingStore(tmpDir);
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    describe('generatePairingCode', () => {
        it('generates code of correct length', () => {
            expect(generatePairingCode(8)).toHaveLength(8);
            expect(generatePairingCode(12)).toHaveLength(12);
        });

        it('uses no ambiguous characters', () => {
            const code = generatePairingCode(100);
            expect(code).not.toMatch(/[OI10l]/);
        });

        it('generates unique codes', () => {
            const codes = new Set(Array.from({ length: 100 }, () => generatePairingCode()));
            expect(codes.size).toBe(100);
        });
    });

    describe('upsert', () => {
        it('creates new request', async () => {
            const result = await store.upsert({ id: 'user-1' });
            expect(result.created).toBe(true);
            expect(result.code).toHaveLength(8);
        });

        it('returns existing on duplicate', async () => {
            const first = await store.upsert({ id: 'user-1' });
            const second = await store.upsert({ id: 'user-1' });
            expect(second.created).toBe(false);
            expect(second.code).toBe(first.code);
        });

        it('stores metadata', async () => {
            await store.upsert({ id: 'user-1', meta: { channel: 'discord' } });
            const pending = store.listPending();
            expect(pending[0].meta).toEqual({ channel: 'discord' });
        });
    });

    describe('accept', () => {
        it('accepts valid code', async () => {
            const { code } = await store.upsert({ id: 'user-1' });
            const request = await store.accept(code);
            expect(request).not.toBeNull();
            expect(request!.id).toBe('user-1');
            expect(store.isAllowed('user-1')).toBe(true);
        });

        it('returns null for invalid code', async () => {
            expect(await store.accept('INVALID')).toBeNull();
        });

        it('removes request after accept', async () => {
            const { code } = await store.upsert({ id: 'user-1' });
            await store.accept(code);
            expect(store.listPending()).toHaveLength(0);
        });
    });

    describe('reject', () => {
        it('rejects valid code', async () => {
            const { code } = await store.upsert({ id: 'user-1' });
            const request = await store.reject(code);
            expect(request).not.toBeNull();
            expect(store.isAllowed('user-1')).toBe(false);
        });
    });

    describe('revoke', () => {
        it('revokes a paired device', async () => {
            const { code } = await store.upsert({ id: 'user-1' });
            await store.accept(code);
            expect(store.isAllowed('user-1')).toBe(true);
            expect(store.revoke('user-1')).toBe(true);
            expect(store.isAllowed('user-1')).toBe(false);
        });

        it('returns false for unknown', () => {
            expect(store.revoke('unknown')).toBe(false);
        });
    });

    describe('listAllowed', () => {
        it('returns paired IDs', async () => {
            const { code: c1 } = await store.upsert({ id: 'user-1' });
            const { code: c2 } = await store.upsert({ id: 'user-2' });
            await store.accept(c1);
            await store.accept(c2);
            expect(store.listAllowed()).toEqual(['user-1', 'user-2']);
        });
    });
});
