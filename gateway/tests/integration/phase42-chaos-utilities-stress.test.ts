/**
 * CoreBlow Phase 42 — Web & Utilities Chaos Tests
 *
 * Layer 3 (Adversarial):
 *   - SchemaValidator: deeply nested edge cases
 *   - Terminal Table: massive columns width
 *   - CredentialResolver: whitespace bombs
 */
import { describe, it, expect } from 'vitest';
import { SchemaValidator } from '../../src/tools/schema-validator.js';
import { renderTable } from '../../src/terminal/table.js';
import { normalizeSecretInput } from '../../src/web-search/credential-resolver.js';

describe('Phase42 Chaos: Utilities Stress', () => {
    it('SchemaValidator deeply nested failure paths', () => {
        const validator = new SchemaValidator();
        const schema = {
            a: { type: 'object' as 'object', properties: { 
                b: { type: 'object' as 'object', properties: {
                    c: { type: 'array' as 'array', items: { type: 'boolean' as 'boolean' } }
                }}
            }}
        };

        const badData = { a: { b: { c: [true, false, "uh oh"] } } };
        const res = validator.validateDirect(badData, schema);
        
        expect(res.valid).toBe(false);
        // Error path traces correctly through nested arrays
        expect(res.errors[0]?.path).toBe('a.b.c[2]');
        expect(res.errors[0]?.message).toContain('Expected boolean');
    });

    it('Terminal Table massive width rendering', () => {
        const rawString = "X".repeat(10000);
        // Shouldn't trigger memory issues or crash
        const table = renderTable(['Col1'], [[rawString]]);
        expect(table.length).toBeGreaterThan(10000);
        
        // Massive borders with massive content
        const bordered = renderTable(['C'], [[rawString]], { borders: true, maxWidth: 10000 });
        expect(bordered.length).toBeGreaterThan(10000);
    });

    it('CredentialResolver whitespace bombs', () => {
        const w1 = " \t \n \r ";
        expect(normalizeSecretInput(w1)).toBeUndefined();

        const w2 = " \t secret \n ";
        expect(normalizeSecretInput(w2)).toBe("secret");
    });
});
