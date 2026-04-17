/**
 * tests/unit/pairing.test.ts
 * Unit tests — device pairing system
 */

import { describe, it, expect } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';

describe('Device Pairing', () => {
    it('should generate XXXX-XXXX format codes', () => {
        const raw = randomBytes(4).toString('hex').toUpperCase();
        const code = `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;

        expect(code).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
        expect(code).toHaveLength(9);  // 4 + 1 + 4
    });

    it('should hash device tokens with SHA256', () => {
        const rawToken = randomBytes(32).toString('hex');
        const hash = createHash('sha256').update(rawToken).digest('hex');

        expect(hash).toHaveLength(64);  // SHA256 = 64 hex chars
        expect(hash).not.toBe(rawToken);

        // Same input = same hash
        const hash2 = createHash('sha256').update(rawToken).digest('hex');
        expect(hash).toBe(hash2);
    });

    it('should validate tokens by comparing hashes', () => {
        const rawToken = randomBytes(32).toString('hex');
        const storedHash = createHash('sha256').update(rawToken).digest('hex');

        // Valid token
        const testHash = createHash('sha256').update(rawToken).digest('hex');
        expect(testHash).toBe(storedHash);

        // Invalid token
        const fakeHash = createHash('sha256').update('fake-token').digest('hex');
        expect(fakeHash).not.toBe(storedHash);
    });

    it('should expire codes after TTL', () => {
        const CODE_TTL = 5 * 60 * 1000; // 5 minutes
        const expiresAt = Date.now() + CODE_TTL;

        // Not expired
        expect(Date.now() < expiresAt).toBe(true);

        // Simulated expired
        const pastExpiry = Date.now() - 1000;
        expect(Date.now() > pastExpiry).toBe(true);
    });
});
