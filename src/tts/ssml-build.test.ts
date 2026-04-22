import { describe, it, expect } from 'vitest';
import { ssml } from './ssml-build.js';

describe('SSML Builder', () => {
    it('should wrap text in speak tags', () => {
        expect(ssml('hello')).toBe('<speak>hello</speak>');
    });

    it('should handle empty text', () => {
        expect(ssml('')).toBe('<speak></speak>');
    });
});
