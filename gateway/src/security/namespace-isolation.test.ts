/**
 * CoreBlow Security — NamespaceIsolation Test Suite
 *
 * Covers: set(), get(), delete(), has(), keys(), getAll(),
 * clearNamespace(), listNamespaces(), count(), cross-tenant
 * isolation guarantees, and edge cases.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { NamespaceIsolation } from './namespace-isolation.js';

describe('NamespaceIsolation', () => {
    let ns: NamespaceIsolation;

    beforeEach(() => {
        ns = new NamespaceIsolation();
    });

    // ─── set() / get() ──────────────────────────────────────────

    describe('set() / get()', () => {
        it('stores and retrieves a value', () => {
            ns.set('tenant-a', 'config', { maxTokens: 1000 });
            expect(ns.get('tenant-a', 'config')).toEqual({ maxTokens: 1000 });
        });

        it('returns undefined for non-existent key', () => {
            expect(ns.get('tenant-a', 'missing')).toBeUndefined();
        });

        it('returns undefined for non-existent namespace', () => {
            expect(ns.get('nonexistent', 'key')).toBeUndefined();
        });

        it('overwrites existing value', () => {
            ns.set('tenant-a', 'key', 'old');
            ns.set('tenant-a', 'key', 'new');
            expect(ns.get('tenant-a', 'key')).toBe('new');
        });

        it('preserves createdAt on update, updates updatedAt', () => {
            ns.set('tenant-a', 'key', 'v1');
            const first = (ns as any).data.get('tenant-a:key');
            const createdAt = first.createdAt;

            // Small delay to ensure different timestamp
            ns.set('tenant-a', 'key', 'v2');
            const second = (ns as any).data.get('tenant-a:key');

            expect(second.createdAt).toBe(createdAt);
            expect(second.updatedAt).toBeGreaterThanOrEqual(createdAt);
        });

        it('stores various value types', () => {
            ns.set('t', 'string', 'hello');
            ns.set('t', 'number', 42);
            ns.set('t', 'bool', true);
            ns.set('t', 'array', [1, 2, 3]);
            ns.set('t', 'object', { a: 1 });
            ns.set('t', 'null', null);

            expect(ns.get('t', 'string')).toBe('hello');
            expect(ns.get('t', 'number')).toBe(42);
            expect(ns.get('t', 'bool')).toBe(true);
            expect(ns.get('t', 'array')).toEqual([1, 2, 3]);
            expect(ns.get('t', 'object')).toEqual({ a: 1 });
            expect(ns.get('t', 'null')).toBeNull();
        });
    });

    // ─── Cross-Tenant Isolation ─────────────────────────────────

    describe('cross-tenant isolation', () => {
        it('isolates data between namespaces', () => {
            ns.set('tenant-a', 'secret', 'A-secret');
            ns.set('tenant-b', 'secret', 'B-secret');

            expect(ns.get('tenant-a', 'secret')).toBe('A-secret');
            expect(ns.get('tenant-b', 'secret')).toBe('B-secret');
        });

        it('cannot access another tenant\'s data', () => {
            ns.set('tenant-a', 'private-key', 'sk-123');
            expect(ns.get('tenant-b', 'private-key')).toBeUndefined();
        });

        it('deleting from one namespace does not affect another', () => {
            ns.set('tenant-a', 'shared-name', 'value-a');
            ns.set('tenant-b', 'shared-name', 'value-b');

            ns.delete('tenant-a', 'shared-name');

            expect(ns.get('tenant-a', 'shared-name')).toBeUndefined();
            expect(ns.get('tenant-b', 'shared-name')).toBe('value-b');
        });

        it('clearing one namespace does not affect another', () => {
            ns.set('tenant-a', 'k1', 'v1');
            ns.set('tenant-a', 'k2', 'v2');
            ns.set('tenant-b', 'k1', 'v1');

            ns.clearNamespace('tenant-a');

            expect(ns.get('tenant-a', 'k1')).toBeUndefined();
            expect(ns.get('tenant-b', 'k1')).toBe('v1');
        });
    });

    // ─── delete() ───────────────────────────────────────────────

    describe('delete()', () => {
        it('deletes an existing key and returns true', () => {
            ns.set('t', 'key', 'value');
            expect(ns.delete('t', 'key')).toBe(true);
            expect(ns.get('t', 'key')).toBeUndefined();
        });

        it('returns false for non-existent key', () => {
            expect(ns.delete('t', 'missing')).toBe(false);
        });
    });

    // ─── has() ──────────────────────────────────────────────────

    describe('has()', () => {
        it('returns true for existing key', () => {
            ns.set('t', 'key', 'value');
            expect(ns.has('t', 'key')).toBe(true);
        });

        it('returns false for non-existent key', () => {
            expect(ns.has('t', 'missing')).toBe(false);
        });

        it('returns false after deletion', () => {
            ns.set('t', 'key', 'value');
            ns.delete('t', 'key');
            expect(ns.has('t', 'key')).toBe(false);
        });
    });

    // ─── keys() ─────────────────────────────────────────────────

    describe('keys()', () => {
        it('returns all keys in a namespace', () => {
            ns.set('t', 'a', 1);
            ns.set('t', 'b', 2);
            ns.set('t', 'c', 3);

            const keys = ns.keys('t');
            expect(keys).toContain('a');
            expect(keys).toContain('b');
            expect(keys).toContain('c');
            expect(keys.length).toBe(3);
        });

        it('returns empty array for empty namespace', () => {
            expect(ns.keys('empty')).toEqual([]);
        });

        it('does not include keys from other namespaces', () => {
            ns.set('tenant-a', 'key-a', 1);
            ns.set('tenant-b', 'key-b', 2);

            const keysA = ns.keys('tenant-a');
            expect(keysA).toContain('key-a');
            expect(keysA).not.toContain('key-b');
        });
    });

    // ─── getAll() ───────────────────────────────────────────────

    describe('getAll()', () => {
        it('returns all key-value pairs in a namespace', () => {
            ns.set('t', 'a', 1);
            ns.set('t', 'b', 'hello');

            const all = ns.getAll('t');
            expect(all).toEqual({ a: 1, b: 'hello' });
        });

        it('returns empty object for empty namespace', () => {
            expect(ns.getAll('empty')).toEqual({});
        });

        it('excludes other namespaces', () => {
            ns.set('tenant-a', 'key', 'a-value');
            ns.set('tenant-b', 'key', 'b-value');

            const allA = ns.getAll('tenant-a');
            expect(allA).toEqual({ key: 'a-value' });
        });
    });

    // ─── clearNamespace() ───────────────────────────────────────

    describe('clearNamespace()', () => {
        it('removes all entries in target namespace and returns count', () => {
            ns.set('t', 'a', 1);
            ns.set('t', 'b', 2);
            ns.set('t', 'c', 3);

            const removed = ns.clearNamespace('t');
            expect(removed).toBe(3);
            expect(ns.keys('t')).toEqual([]);
        });

        it('returns 0 for empty namespace', () => {
            expect(ns.clearNamespace('empty')).toBe(0);
        });
    });

    // ─── listNamespaces() ───────────────────────────────────────

    describe('listNamespaces()', () => {
        it('lists all namespaces with entry counts', () => {
            ns.set('tenant-a', 'k1', 1);
            ns.set('tenant-a', 'k2', 2);
            ns.set('tenant-b', 'k1', 1);

            const list = ns.listNamespaces();
            expect(list.length).toBe(2);

            const a = list.find(n => n.namespace === 'tenant-a')!;
            expect(a.entryCount).toBe(2);

            const b = list.find(n => n.namespace === 'tenant-b')!;
            expect(b.entryCount).toBe(1);
        });

        it('returns empty array when no data', () => {
            expect(ns.listNamespaces()).toEqual([]);
        });
    });

    // ─── count() ────────────────────────────────────────────────

    describe('count()', () => {
        it('returns total entry count across all namespaces', () => {
            ns.set('a', 'k1', 1);
            ns.set('a', 'k2', 2);
            ns.set('b', 'k1', 1);

            expect(ns.count()).toBe(3);
        });

        it('returns 0 initially', () => {
            expect(ns.count()).toBe(0);
        });
    });

    // ─── Edge Cases ─────────────────────────────────────────────

    describe('edge cases', () => {
        it('handles namespace with colon in name', () => {
            ns.set('org:team', 'config', 'value');
            expect(ns.get('org:team', 'config')).toBe('value');
        });

        it('handles empty key name', () => {
            ns.set('t', '', 'empty-key');
            expect(ns.get('t', '')).toBe('empty-key');
        });

        it('handles empty namespace name', () => {
            ns.set('', 'key', 'value');
            expect(ns.get('', 'key')).toBe('value');
        });
    });
});
