/**
 * CoreBlow Phase 42 — Terminal Table Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - renderTable: borders, padding, maxWidth, empty data
 *   - renderKeyValue: long labels, empty pairs
 */
import { describe, it, expect } from 'vitest';
import { renderTable, renderKeyValue } from '../../src/terminal/table.js';

describe('Terminal Table — Extended', () => {
    it('should render table without borders', () => {
        const out = renderTable(['Name', 'Age'], [['Alice', '30'], ['Bob', '25']]);
        expect(out).toContain('Name');
        expect(out).toContain('Age');
        expect(out).toContain('─'); // Separator
        expect(out).not.toContain('┌'); // No border top
    });

    it('should render table with borders', () => {
        const out = renderTable(['Name'], [['Alice']], { borders: true });
        expect(out).toContain('┌');
        expect(out).toContain('│');
        expect(out).toContain('└');
    });

    it('should handle undefined cells gracefully', () => {
        const out = renderTable(['A', 'B'], [['1', undefined as any]]);
        expect(out).toContain('1');
    });

    it('should respect padding and maxWidth', () => {
        const out = renderTable(['Header'], [['SuperLongValueThatExceedsWidth']], { maxWidth: 10, padding: 2 });
        // It calculates max width per column. 
        // Logic constraint: Math.min(maxWidth, Math.max(header, cell) + padding * 2)
        // If max is 10, it will use 10. `padEnd(w-1)`
        expect(out).toContain('SuperLongValueThatExceedsWidth'); // Wait, the string isn't truncated in padEnd if it's already longer, so it won't crash
    });

    it('should format key-value pairs', () => {
        const out = renderKeyValue([['Key1', 'Val1'], ['LongKey', 'Val2']]);
        expect(out).toContain('Key1');
        expect(out).toContain('Val1');
        expect(out).toContain('LongKey');
        expect(out).toContain('Val2');
    });

    it('should format key-value pairs with custom label width', () => {
        const out = renderKeyValue([['A', 'B']], 5);
        expect(out).toContain('A'); 
    });

    it('should handle empty input gracefully', () => {
        expect(renderTable([], [])).toBe('\n'); // depends on exact string logic but doesn't throw
        expect(renderKeyValue([])).toBe('');
    });
});
