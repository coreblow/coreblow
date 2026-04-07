/**
 * routing/load-balance.test.ts — Load balancing tests
 */
import { describe, it, expect } from 'vitest';
import { roundRobin } from './load-balance.js';

describe('Load Balance', () => {
    it('should round robin through items', () => {
        const items = ['a', 'b', 'c'];
        const counter = { value: -1 };
        expect(roundRobin(items, counter)).toBe('a');
        expect(roundRobin(items, counter)).toBe('b');
        expect(roundRobin(items, counter)).toBe('c');
        expect(roundRobin(items, counter)).toBe('a');
    });
});
