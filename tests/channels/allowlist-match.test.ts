/**
 * Tests: Channel Policy — Allowlist Match Engine
 * Port pola dari coreblow/src/channels/allowlist-match.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
    compileAllowlist,
    resolveCompiledAllowlistMatch,
    resolveAllowlistMatchByCandidates,
    resolveAllowlistMatchSimple,
    formatAllowlistMatchMeta,
} from '../../src/channels/policy/allowlist-match.js';

describe('compileAllowlist', () => {
    it('creates set from entries', () => {
        const list = compileAllowlist(['user1', 'user2', 'admin']);
        expect(list.set.has('user1')).toBe(true);
        expect(list.set.has('user2')).toBe(true);
        expect(list.wildcard).toBe(false);
    });

    it('detects wildcard *', () => {
        const list = compileAllowlist(['user1', '*']);
        expect(list.wildcard).toBe(true);
    });

    it('lowercases entries', () => {
        const list = compileAllowlist(['User1', 'ADMIN']);
        expect(list.set.has('user1')).toBe(true);
        expect(list.set.has('admin')).toBe(true);
    });

    it('filters empty entries', () => {
        const list = compileAllowlist(['', 'user1', '  ']);
        expect(list.set.size).toBe(1);
    });

    it('handles empty array', () => {
        const list = compileAllowlist([]);
        expect(list.set.size).toBe(0);
        expect(list.wildcard).toBe(false);
    });
});

describe('resolveCompiledAllowlistMatch', () => {
    it('returns denied for empty allowlist', () => {
        const result = resolveCompiledAllowlistMatch({
            compiledAllowlist: compileAllowlist([]),
            candidates: [{ value: 'user1', source: 'id' as const }],
        });
        expect(result.allowed).toBe(false);
    });

    it('returns wildcard match for * list', () => {
        const result = resolveCompiledAllowlistMatch({
            compiledAllowlist: compileAllowlist(['*']),
            candidates: [{ value: 'anyone', source: 'id' as const }],
        });
        expect(result.allowed).toBe(true);
        expect(result.matchSource).toBe('wildcard');
        expect(result.matchKey).toBe('*');
    });

    it('matches by id', () => {
        const result = resolveCompiledAllowlistMatch({
            compiledAllowlist: compileAllowlist(['user123']),
            candidates: [{ value: 'user123', source: 'id' as const }],
        });
        expect(result.allowed).toBe(true);
        expect(result.matchSource).toBe('id');
    });

    it('returns denied for non-matching candidate', () => {
        const result = resolveCompiledAllowlistMatch({
            compiledAllowlist: compileAllowlist(['admin']),
            candidates: [{ value: 'user1', source: 'id' as const }],
        });
        expect(result.allowed).toBe(false);
    });

    it('stops at first matching candidate', () => {
        const result = resolveCompiledAllowlistMatch({
            compiledAllowlist: compileAllowlist(['name1']),
            candidates: [
                { value: 'user1', source: 'id' as const },
                { value: 'name1', source: 'name' as const },
            ],
        });
        expect(result.allowed).toBe(true);
        expect(result.matchSource).toBe('name');
    });

    it('skips undefined candidate values', () => {
        const result = resolveCompiledAllowlistMatch({
            compiledAllowlist: compileAllowlist(['user1']),
            candidates: [
                { value: undefined, source: 'id' as const },
                { value: 'user1', source: 'name' as const },
            ],
        });
        expect(result.allowed).toBe(true);
        expect(result.matchSource).toBe('name');
    });
});

describe('resolveAllowlistMatchByCandidates', () => {
    it('compiles and matches in one call', () => {
        const result = resolveAllowlistMatchByCandidates({
            allowList: ['admin', 'user1'],
            candidates: [{ value: 'user1', source: 'id' as const }],
        });
        expect(result.allowed).toBe(true);
    });
});

describe('resolveAllowlistMatchSimple', () => {
    it('allows match by senderId', () => {
        const result = resolveAllowlistMatchSimple({
            allowFrom: ['user1', 'user2'],
            senderId: 'user1',
        });
        expect(result.allowed).toBe(true);
        expect(result.matchSource).toBe('id');
    });

    it('denies for unrecognized sender', () => {
        const result = resolveAllowlistMatchSimple({
            allowFrom: ['admin'],
            senderId: 'hacker',
        });
        expect(result.allowed).toBe(false);
    });

    it('allows wildcard for any sender', () => {
        const result = resolveAllowlistMatchSimple({
            allowFrom: ['*'],
            senderId: 'anyone',
        });
        expect(result.allowed).toBe(true);
        expect(result.matchSource).toBe('wildcard');
    });

    it('denies all when allowFrom is empty', () => {
        const result = resolveAllowlistMatchSimple({
            allowFrom: [],
            senderId: 'user1',
        });
        expect(result.allowed).toBe(false);
    });

    it('matches by name when allowNameMatching is true', () => {
        const result = resolveAllowlistMatchSimple({
            allowFrom: ['Alice'],
            senderId: 'unknown-id',
            senderName: 'Alice',
            allowNameMatching: true,
        });
        expect(result.allowed).toBe(true);
        expect(result.matchSource).toBe('name');
    });

    it('does not match by name when allowNameMatching is false', () => {
        const result = resolveAllowlistMatchSimple({
            allowFrom: ['Alice'],
            senderId: 'unknown-id',
            senderName: 'Alice',
            allowNameMatching: false,
        });
        expect(result.allowed).toBe(false);
    });

    it('is case-insensitive for id matching', () => {
        const result = resolveAllowlistMatchSimple({
            allowFrom: ['USER1'],
            senderId: 'user1',
        });
        expect(result.allowed).toBe(true);
    });
});

describe('formatAllowlistMatchMeta', () => {
    it('formats match with key and source', () => {
        const msg = formatAllowlistMatchMeta({ matchKey: 'user1', matchSource: 'id' });
        expect(msg).toContain('user1');
        expect(msg).toContain('id');
    });

    it('handles null/undefined gracefully', () => {
        const msg = formatAllowlistMatchMeta(null);
        expect(msg).toContain('none');
    });

    it('handles missing match', () => {
        const msg = formatAllowlistMatchMeta();
        expect(msg).toContain('none');
    });
});
