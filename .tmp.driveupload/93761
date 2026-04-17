/**
 * CoreBlow Phase 30 — Namespace Isolation Deep Edge Cases
 *
 * Layer 1 (Edge Cases) for:
 *   - NamespaceIsolation: complex values, delete, overwrite, collision, scale
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { NamespaceIsolation } from '../../src/security/namespace-isolation.js';

describe('NamespaceIsolation — Deep Edge Cases', () => {
    let ns: NamespaceIsolation;

    beforeEach(() => { ns = new NamespaceIsolation(); });

    it('should store and retrieve complex value types', () => {
        ns.set('t1', 'array', [1, 2, 3]);
        ns.set('t1', 'nested', { a: { b: { c: 'deep' } } });
        ns.set('t1', 'null-val', null);

        expect(ns.get('t1', 'array')).toEqual([1, 2, 3]);
        expect(ns.get('t1', 'nested')).toEqual({ a: { b: { c: 'deep' } } });
        expect(ns.get('t1', 'null-val')).toBeNull();
    });

    it('should delete individual key from namespace', () => {
        ns.set('t1', 'keep', 'yes');
        ns.set('t1', 'remove', 'bye');

        expect(ns.delete('t1', 'remove')).toBe(true);
        expect(ns.has('t1', 'remove')).toBe(false);
        expect(ns.has('t1', 'keep')).toBe(true);
        expect(ns.keys('t1')).toHaveLength(1);
    });

    it('should return false when deleting non-existent key', () => {
        expect(ns.delete('t1', 'ghost')).toBe(false);
    });

    it('should clear namespace and return correct count', () => {
        ns.set('t1', 'a', 1);
        ns.set('t1', 'b', 2);
        ns.set('t1', 'c', 3);
        ns.set('t2', 'x', 99);

        const cleared = ns.clearNamespace('t1');
        expect(cleared).toBe(3);
        expect(ns.keys('t1')).toHaveLength(0);
        // t2 should be unaffected
        expect(ns.get('t2', 'x')).toBe(99);
    });

    it('should list namespaces after partial cleanup', () => {
        ns.set('t1', 'a', 1);
        ns.set('t2', 'b', 2);
        ns.set('t3', 'c', 3);

        ns.clearNamespace('t2');
        const namespaces = ns.listNamespaces();
        expect(namespaces).toHaveLength(2);
        expect(namespaces.map(n => n.namespace).sort()).toEqual(['t1', 't3']);
    });

    it('should return undefined for non-existent namespace key', () => {
        expect(ns.get('nonexistent', 'key')).toBeUndefined();
    });

    it('should overwrite existing key value', () => {
        ns.set('t1', 'config', { v: 1 });
        ns.set('t1', 'config', { v: 2 });

        expect(ns.get('t1', 'config')).toEqual({ v: 2 });
        expect(ns.keys('t1')).toHaveLength(1); // Still one key
    });

    it('should handle same key name across different namespaces', () => {
        ns.set('tenant-alpha', 'settings', { theme: 'dark' });
        ns.set('tenant-beta', 'settings', { theme: 'light' });
        ns.set('tenant-gamma', 'settings', { theme: 'auto' });

        expect(ns.get('tenant-alpha', 'settings')).toEqual({ theme: 'dark' });
        expect(ns.get('tenant-beta', 'settings')).toEqual({ theme: 'light' });
        expect(ns.get('tenant-gamma', 'settings')).toEqual({ theme: 'auto' });
        expect(ns.count()).toBe(3);
    });

    it('should handle large namespace with 100+ keys', () => {
        for (let i = 0; i < 150; i++) {
            ns.set('big-tenant', `key-${i}`, { index: i });
        }

        expect(ns.keys('big-tenant')).toHaveLength(150);
        expect(ns.get('big-tenant', 'key-0')).toEqual({ index: 0 });
        expect(ns.get('big-tenant', 'key-149')).toEqual({ index: 149 });

        const all = ns.getAll('big-tenant');
        expect(Object.keys(all)).toHaveLength(150);
    });

    it('should report correct count after mixed operations', () => {
        ns.set('t1', 'a', 1);
        ns.set('t1', 'b', 2);
        ns.set('t2', 'c', 3);
        expect(ns.count()).toBe(3);

        ns.delete('t1', 'a');
        expect(ns.count()).toBe(2);

        ns.clearNamespace('t2');
        expect(ns.count()).toBe(1);
    });
});
