import { describe, it, expect } from 'vitest';
import { parseAbsoluteTimeMs } from './parse.js';
import { normalizeHttpWebhookUrl } from './webhook-url.js';

describe('parseAbsoluteTimeMs', () => {
    it('parses Unix timestamp (numeric string)', () => {
        expect(parseAbsoluteTimeMs('1700000000000')).toBe(1700000000000);
    });

    it('parses ISO date', () => {
        const result = parseAbsoluteTimeMs('2025-01-15');
        expect(result).toBe(Date.parse('2025-01-15T00:00:00Z'));
    });

    it('parses ISO datetime', () => {
        const result = parseAbsoluteTimeMs('2025-01-15T09:30:00');
        expect(result).toBe(Date.parse('2025-01-15T09:30:00Z'));
    });

    it('parses ISO with timezone', () => {
        const result = parseAbsoluteTimeMs('2025-01-15T09:30:00Z');
        expect(result).toBe(Date.parse('2025-01-15T09:30:00Z'));
    });

    it('returns null for empty', () => {
        expect(parseAbsoluteTimeMs('')).toBeNull();
    });

    it('returns null for invalid', () => {
        expect(parseAbsoluteTimeMs('not-a-date')).toBeNull();
    });
});

describe('normalizeHttpWebhookUrl', () => {
    it('accepts https URL', () => {
        expect(normalizeHttpWebhookUrl('https://example.com/hook')).toBe('https://example.com/hook');
    });

    it('accepts http URL', () => {
        expect(normalizeHttpWebhookUrl('http://localhost:3000/hook')).toBe('http://localhost:3000/hook');
    });

    it('rejects ftp protocol', () => {
        expect(normalizeHttpWebhookUrl('ftp://example.com')).toBeNull();
    });

    it('rejects non-string', () => {
        expect(normalizeHttpWebhookUrl(123)).toBeNull();
        expect(normalizeHttpWebhookUrl(null)).toBeNull();
    });

    it('rejects empty string', () => {
        expect(normalizeHttpWebhookUrl('')).toBeNull();
    });

    it('rejects invalid URL', () => {
        expect(normalizeHttpWebhookUrl('not a url')).toBeNull();
    });
});
