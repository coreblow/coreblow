/**
 * secrets/key-rotation.test.ts — Key rotation tests
 */
import { describe, it, expect } from 'vitest';
import { KeyRotation } from './key-rotation.js';

describe('KeyRotation', () => {
    it('should add key and set active', () => {
        const kr = new KeyRotation();
        kr.add('key1');
        expect(kr.getActive()).toBe('key1');
    });

    it('should deactivate old key on add', () => {
        const kr = new KeyRotation();
        kr.add('key1');
        kr.add('key2');
        expect(kr.getActive()).toBe('key2');
        expect(kr.getAll()).toHaveLength(2);
    });

    it('should detect rotation needed when no keys', () => {
        const kr = new KeyRotation();
        expect(kr.needsRotation()).toBe(true);
    });

    it('should not need rotation for fresh key', () => {
        const kr = new KeyRotation();
        kr.add('key1');
        // Default maxAge is 30 days — fresh key should not need rotation
        expect(kr.needsRotation()).toBe(false);
    });
});
