/**
 * secrets/key-rotation-deep.test.ts — Key rotation deep tests
 */
import { describe, it, expect } from 'vitest';
import { KeyRotation } from './key-rotation.js';

describe('Key Rotation Deep', () => {
    it('creates a rotation manager', () => {
        const rotation = new KeyRotation({ gracePeriodMs: 7 * 24 * 60 * 60 * 1000 });
        rotation.add('current-key', 'k1');
        expect(rotation.getActive()).toBe('current-key');
    });

    it('rotates key and keeps old key in grace period', () => {
        const rotation = new KeyRotation({ gracePeriodMs: 10000 });
        rotation.add('old-key', 'k1');
        rotation.add('new-key', 'k2');
        expect(rotation.getActive()).toBe('new-key');
        const keys = rotation.getDecryptionKeys();
        expect(keys).toContain('old-key');
        expect(keys).toContain('new-key');
    });

    it('purges expired keys', async () => {
        const rotation = new KeyRotation({ gracePeriodMs: 50 });
        rotation.add('old-key', 'k1');
        rotation.add('new-key', 'k2');
        expect(rotation.getDecryptionKeys()).toHaveLength(2);
        await new Promise((r) => setTimeout(r, 100));
        rotation.purgeExpired();
        expect(rotation.getDecryptionKeys()).toHaveLength(1);
        expect(rotation.getDecryptionKeys()[0]).toBe('new-key');
    });

    it('tracks audit log', () => {
        const rotation = new KeyRotation({ gracePeriodMs: 10000 });
        rotation.add('key-1', 'k1');
        rotation.add('key-2', 'k2');
        const log = rotation.getAuditLog();
        expect(log.length).toBeGreaterThanOrEqual(3); // created+activated for k1, retired+created+activated for k2
    });

    it('needsRotation returns true when no active key', () => {
        const rotation = new KeyRotation();
        expect(rotation.needsRotation()).toBe(true);
    });

    it('needsRotation returns false for fresh key', () => {
        const rotation = new KeyRotation();
        rotation.add('fresh-key', 'k1');
        expect(rotation.needsRotation()).toBe(false);
    });

    it('getAll returns all keys', () => {
        const rotation = new KeyRotation({ gracePeriodMs: 10000 });
        rotation.add('k1', 'id1');
        rotation.add('k2', 'id2');
        expect(rotation.getAll()).toHaveLength(2);
    });

    it('loadKeys restores state', () => {
        const rotation = new KeyRotation();
        rotation.loadKeys([
            { id: 'k1', key: 'val1', createdAt: Date.now(), active: true },
        ]);
        expect(rotation.getActive()).toBe('val1');
    });

    it('rotate generates a new random key', () => {
        const rotation = new KeyRotation();
        const entry = rotation.rotate();
        expect(entry.key.length).toBeGreaterThan(10);
        expect(entry.active).toBe(true);
    });
});
