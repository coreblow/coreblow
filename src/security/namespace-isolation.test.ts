/**
 * CoreBlow — Namespace Isolation Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { NamespaceIsolation } from './namespace-isolation.js';

describe('NamespaceIsolation', () => {
    let ns: NamespaceIsolation;

    beforeEach(() => {
        ns = new NamespaceIsolation();
    });

    // ─── Basic CRUD ──────────────────────────────────────────────

    describe('set & get', () => {
        it('should store and retrieve a value', () => {
            ns.set('tenant-a', 'key1', 'value1');
            expect(ns.get('tenant-a', 'key1')).toBe('value1');
        });

        it('should store objects', () => {
            ns.set('t', 'data', { x: 1, y: 2 });
            expect(ns.get('t', 'data')).toEqual({ x: 1, y: 2 });
        });

        it('should return undefined for non-existent key', () => {
            expect(ns.get('tenant-a', 'missing')).toBeUndefined();
        });

        it('should return undefined for non-existent namespace', () => {
            expect(ns.get('nonexistent', 'key')).toBeUndefined();
        });

        it('should overwrite existing value', () => {
            ns.set('t', 'k', 'old');
            ns.set('t', 'k', 'new');
            expect(ns.get('t', 'k')).toBe('new');
        });
    });

    // ─── Tenant Isolation ────────────────────────────────────────

    describe('cross-tenant isolation', () => {
        it('should isolate data between namespaces', () => {
            ns.set('tenant-a', 'secret', 'A-secret');
            ns.set('tenant-b', 'secret', 'B-secret');
            expect(ns.get('tenant-a', 'secret')).toBe('A-secret');
            expect(ns.get('tenant-b', 'secret')).toBe('B-secret');
        });

        it('tenant-b should not access tenant-a keys', () => {
            ns.set('tenant-a', 'private', 'hidden');
            expect(ns.get('tenant-b', 'private')).toBeUndefined();
        });

        it('same key in different namespaces should be independent', () => {
            ns.set('a', 'count', 1);
            ns.set('b', 'count', 99);
            ns.delete('a', 'count');
            expect(ns.get('a', 'count')).toBeUndefined();
            expect(ns.get('b', 'count')).toBe(99);
        });
    });

    // ─── has ─────────────────────────────────────────────────────

    describe('has', () => {
        it('should return true for existing key', () => {
            ns.set('t', 'k', 'v');
            expect(ns.has('t', 'k')).toBe(true);
        });

        it('should return false for missing key', () => {
            expect(ns.has('t', 'missing')).toBe(false);
        });

        it('should return false after deletion', () => {
            ns.set('t', 'k', 'v');
            ns.delete('t', 'k');
            expect(ns.has('t', 'k')).toBe(false);
        });
    });

    // ─── delete ──────────────────────────────────────────────────

    describe('delete', () => {
        it('should delete an existing key and return true', () => {
            ns.set('t', 'k', 'v');
            expect(ns.delete('t', 'k')).toBe(true);
            expect(ns.get('t', 'k')).toBeUndefined();
        });

        it('should return false for non-existent key', () => {
            expect(ns.delete('t', 'missing')).toBe(false);
        });
    });

    // ─── keys ────────────────────────────────────────────────────

    describe('keys', () => {
        it('should list all keys in a namespace', () => {
            ns.set('t', 'a', 1);
            ns.set('t', 'b', 2);
            ns.set('t', 'c', 3);
            const keys = ns.keys('t');
            expect(keys).toHaveLength(3);
            expect(keys).toContain('a');
            expect(keys).toContain('b');
            expect(keys).toContain('c');
        });

        it('should return empty array for empty namespace', () => {
            expect(ns.keys('empty')).toEqual([]);
        });

        it('should not include keys from other namespaces', () => {
            ns.set('a', 'k1', 1);
            ns.set('b', 'k2', 2);
            expect(ns.keys('a')).toEqual(['k1']);
        });
    });

    // ─── getAll ──────────────────────────────────────────────────

    describe('getAll', () => {
        it('should return all key-value pairs in a namespace', () => {
            ns.set('t', 'x', 10);
            ns.set('t', 'y', 20);
            expect(ns.getAll('t')).toEqual({ x: 10, y: 20 });
        });

        it('should return empty object for unknown namespace', () => {
            expect(ns.getAll('unknown')).toEqual({});
        });
    });

    // ─── clearNamespace ──────────────────────────────────────────

    describe('clearNamespace', () => {
        it('should clear all entries in a namespace', () => {
            ns.set('t', 'a', 1);
            ns.set('t', 'b', 2);
            const count = ns.clearNamespace('t');
            expect(count).toBe(2);
            expect(ns.keys('t')).toEqual([]);
        });

        it('should not affect other namespaces', () => {
            ns.set('a', 'k', 1);
            ns.set('b', 'k', 2);
            ns.clearNamespace('a');
            expect(ns.get('b', 'k')).toBe(2);
        });

        it('should return 0 for empty namespace', () => {
            expect(ns.clearNamespace('empty')).toBe(0);
        });
    });

    // ─── listNamespaces ──────────────────────────────────────────

    describe('listNamespaces', () => {
        it('should list all namespaces with entry counts', () => {
            ns.set('a', 'k1', 1);
            ns.set('a', 'k2', 2);
            ns.set('b', 'k1', 3);
            const list = ns.listNamespaces();
            expect(list).toHaveLength(2);
            const nsA = list.find((n) => n.namespace === 'a')!;
            const nsB = list.find((n) => n.namespace === 'b')!;
            expect(nsA.entryCount).toBe(2);
            expect(nsB.entryCount).toBe(1);
        });

        it('should return empty array when no data', () => {
            expect(ns.listNamespaces()).toEqual([]);
        });
    });

    // ─── count ───────────────────────────────────────────────────

    describe('count', () => {
        it('should return total entries across all namespaces', () => {
            ns.set('a', 'k1', 1);
            ns.set('b', 'k2', 2);
            expect(ns.count()).toBe(2);
        });

        it('should return 0 when empty', () => {
            expect(ns.count()).toBe(0);
        });
    });

    // ─── Edge Cases ──────────────────────────────────────────────

    describe('edge cases', () => {
        it('should handle empty string as namespace', () => {
            ns.set('', 'k', 'v');
            expect(ns.get('', 'k')).toBe('v');
        });

        it('should handle empty string as key', () => {
            ns.set('t', '', 'v');
            expect(ns.get('t', '')).toBe('v');
        });

        it('should handle colons in keys without confusion', () => {
            // Internal composite key is "ns:key" — colons in key name shouldn't break
            ns.set('t', 'a:b:c', 'v');
            expect(ns.get('t', 'a:b:c')).toBe('v');
        });
    });
});
