import { describe, it, expect } from 'vitest';
import {
    buildAnnounceIdFromChildRun,
    buildAnnounceIdempotencyKey,
    resolveQueueAnnounceId,
} from './announce-idempotency.js';

describe('buildAnnounceIdFromChildRun', () => {
    it('builds v1 prefixed announce ID', () => {
        const id = buildAnnounceIdFromChildRun({
            childSessionKey: 'session-abc',
            childRunId: 'run-123',
        });
        expect(id).toBe('v1:session-abc:run-123');
    });

    it('includes session and run components', () => {
        const id = buildAnnounceIdFromChildRun({
            childSessionKey: 'sk',
            childRunId: 'rid',
        });
        expect(id).toContain('sk');
        expect(id).toContain('rid');
        expect(id.startsWith('v1:')).toBe(true);
    });
});

describe('buildAnnounceIdempotencyKey', () => {
    it('prefixes with announce:', () => {
        expect(buildAnnounceIdempotencyKey('my-id')).toBe('announce:my-id');
    });

    it('works with complex IDs', () => {
        const key = buildAnnounceIdempotencyKey('v1:session:run');
        expect(key).toBe('announce:v1:session:run');
    });
});

describe('resolveQueueAnnounceId', () => {
    it('uses provided announceId when present', () => {
        const id = resolveQueueAnnounceId({
            announceId: 'explicit-id',
            sessionKey: 'sk',
            enqueuedAt: 1000,
        });
        expect(id).toBe('explicit-id');
    });

    it('trims whitespace from announceId', () => {
        const id = resolveQueueAnnounceId({
            announceId: '  trimmed  ',
            sessionKey: 'sk',
            enqueuedAt: 1000,
        });
        expect(id).toBe('trimmed');
    });

    it('falls back to legacy format when announceId is empty', () => {
        const id = resolveQueueAnnounceId({
            announceId: '',
            sessionKey: 'session-key',
            enqueuedAt: 1234567890,
        });
        expect(id).toBe('legacy:session-key:1234567890');
    });

    it('falls back to legacy when announceId is undefined', () => {
        const id = resolveQueueAnnounceId({
            sessionKey: 'sk',
            enqueuedAt: 999,
        });
        expect(id).toBe('legacy:sk:999');
    });

    it('falls back to legacy when announceId is whitespace only', () => {
        const id = resolveQueueAnnounceId({
            announceId: '   ',
            sessionKey: 'sk',
            enqueuedAt: 42,
        });
        expect(id).toBe('legacy:sk:42');
    });
});
