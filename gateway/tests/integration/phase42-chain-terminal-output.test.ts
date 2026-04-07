/**
 * CoreBlow Phase 42 — Terminal Display Chain Tests
 *
 * Layer 2 (Pipeline):
 *   Data → Schema Validate → Term KV → Term Table
 */
import { describe, it, expect } from 'vitest';
import { SchemaValidator } from '../../src/tools/schema-validator.js';
import { renderTable, renderKeyValue } from '../../src/terminal/table.js';

describe('Phase42 Chain: Terminal Output Formatting', () => {
    it('validate schema then render payload to terminal', () => {
        // 1. Validate data shape
        const schema = {
            id: { type: 'string' as 'string' },
            items: { type: 'number' as 'number' },
        };
        const validator = new SchemaValidator();
        const payload = { id: 'order_123', items: 5 };
        const valid = validator.validateDirect(payload, schema);
        expect(valid.valid).toBe(true);

        // 2. Render Header (KV)
        const header = renderKeyValue([
            ['Order ID', payload.id],
            ['Total Items', payload.items.toString()]
        ]);
        expect(header).toContain('order_123');

        // 3. Render contents (Table)
        const table = renderTable(['Item', 'Qty'], [['Apple', '2'], ['Banana', '3']]);
        expect(table).toContain('Apple');
        expect(table).toContain('2');
        expect(table).toContain('Banana');

        // 4. Combine
        const finalOutput = `${header}\n\n${table}`;
        expect(finalOutput).toContain('order_123');
        expect(finalOutput).toContain('Apple');
    });
});
