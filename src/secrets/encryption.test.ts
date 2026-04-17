/**
 * secrets/encryption.test.ts — AES-256-GCM encryption tests
 */
import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, generateEncryptionKey, hashSecret } from './encryption.js';

describe('AES-256-GCM Encryption', () => {
    const TEST_KEY = 'test-encryption-key-for-unit-tests-32chars!';

    it('encrypts and decrypts a string', () => {
        const plaintext = 'sk-1234567890abcdefghijklmnopqrstuvwxyz';
        const encrypted = encrypt(plaintext, TEST_KEY);
        expect(encrypted).not.toBe(plaintext);
        const decrypted = decrypt(encrypted, TEST_KEY);
        expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertext for same plaintext', () => {
        const plaintext = 'same-secret-value';
        const a = encrypt(plaintext, TEST_KEY);
        const b = encrypt(plaintext, TEST_KEY);
        expect(a).not.toBe(b);
    });

    it('fails to decrypt with wrong key', () => {
        const encrypted = encrypt('secret', TEST_KEY);
        expect(() => decrypt(encrypted, 'wrong-key-that-is-also-32chars!!')).toThrow();
    });

    it('handles empty string', () => {
        const encrypted = encrypt('', TEST_KEY);
        const decrypted = decrypt(encrypted, TEST_KEY);
        expect(decrypted).toBe('');
    });

    it('handles long strings', () => {
        const longText = 'x'.repeat(100000);
        const encrypted = encrypt(longText, TEST_KEY);
        const decrypted = decrypt(encrypted, TEST_KEY);
        expect(decrypted).toBe(longText);
    });

    it('handles unicode content', () => {
        const unicode = '🔑 Ключ шифрования 暗号化キー';
        const encrypted = encrypt(unicode, TEST_KEY);
        const decrypted = decrypt(encrypted, TEST_KEY);
        expect(decrypted).toBe(unicode);
    });

    it('output format is salt:iv:authTag:ciphertext', () => {
        const encrypted = encrypt('test', TEST_KEY);
        const parts = encrypted.split(':');
        expect(parts).toHaveLength(4);
        // All parts should be hex
        for (const part of parts) {
            expect(part).toMatch(/^[0-9a-f]+$/i);
        }
    });

    it('generateEncryptionKey produces unique keys', () => {
        const a = generateEncryptionKey();
        const b = generateEncryptionKey();
        expect(a).not.toBe(b);
        expect(a.length).toBeGreaterThan(20);
    });

    it('hashSecret produces consistent results', () => {
        const a = hashSecret('my-secret');
        const b = hashSecret('my-secret');
        expect(a).toBe(b);
    });

    it('hashSecret produces different results for different inputs', () => {
        expect(hashSecret('secret-a')).not.toBe(hashSecret('secret-b'));
    });
});
