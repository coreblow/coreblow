import { describe, it, expect, vi } from 'vitest';

// Mock external-content to isolate channel-metadata logic
vi.mock('./external-content.js', () => ({
    wrapExternalContent: (content: string, _opts: any) => `[WRAPPED]${content}[/WRAPPED]`,
}));

import { buildUntrustedChannelMetadata } from './channel-metadata.js';

describe('buildUntrustedChannelMetadata', () => {
    it('should return undefined for empty entries', () => {
        expect(buildUntrustedChannelMetadata({
            source: 'discord',
            label: 'Guild',
            entries: [],
        })).toBeUndefined();
    });

    it('should return undefined for all-null entries', () => {
        expect(buildUntrustedChannelMetadata({
            source: 'discord',
            label: 'Guild',
            entries: [null, undefined, null],
        })).toBeUndefined();
    });

    it('should return undefined for all-empty-string entries', () => {
        expect(buildUntrustedChannelMetadata({
            source: 'discord',
            label: 'Guild',
            entries: ['', '  ', ''],
        })).toBeUndefined();
    });

    it('should build metadata from valid entries', () => {
        const result = buildUntrustedChannelMetadata({
            source: 'discord',
            label: 'Guild Name',
            entries: ['Test Guild'],
        });
        expect(result).toBeDefined();
        expect(result).toContain('[WRAPPED]');
        expect(result).toContain('UNTRUSTED');
        expect(result).toContain('discord');
        expect(result).toContain('Guild Name');
        expect(result).toContain('Test Guild');
    });

    it('should filter out null/undefined entries', () => {
        const result = buildUntrustedChannelMetadata({
            source: 'slack',
            label: 'Channel',
            entries: [null, 'valid-entry', undefined, 'another'],
        });
        expect(result).toBeDefined();
        expect(result).toContain('valid-entry');
        expect(result).toContain('another');
    });

    it('should normalize whitespace in entries', () => {
        const result = buildUntrustedChannelMetadata({
            source: 'telegram',
            label: 'Chat',
            entries: ['hello   world   test'],
        });
        expect(result).toBeDefined();
        expect(result).toContain('hello world test');
    });

    it('should deduplicate entries', () => {
        const result = buildUntrustedChannelMetadata({
            source: 'discord',
            label: 'Guild',
            entries: ['Same Entry', 'Same Entry', 'Same Entry'],
        });
        expect(result).toBeDefined();
        // Only one occurrence after dedup
        const matches = result!.match(/Same Entry/g);
        expect(matches).toHaveLength(1);
    });

    it('should truncate long entries to 400 chars', () => {
        const longEntry = 'a'.repeat(500);
        const result = buildUntrustedChannelMetadata({
            source: 'discord',
            label: 'Guild',
            entries: [longEntry],
        });
        expect(result).toBeDefined();
        // Original 500 chars should be truncated
        expect(result!.includes('a'.repeat(500))).toBe(false);
        expect(result).toContain('...');
    });

    it('should respect custom maxChars', () => {
        const result = buildUntrustedChannelMetadata({
            source: 'discord',
            label: 'Guild',
            entries: ['Short entry'],
            maxChars: 50,
        });
        expect(result).toBeDefined();
    });
});
