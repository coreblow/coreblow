import { describe, it, expect } from 'vitest';
import { resolveFunctionModuleExport, buildImportUrl } from '../../src/hooks/loader.js';

describe('hooks/loader', () => {
    describe('resolveFunctionModuleExport', () => {
        it('resolves explicit named export', () => {
            const mod = { myHandler: () => 'hello', default: () => 'default' };
            const fn = resolveFunctionModuleExport({ mod, exportName: 'myHandler' });
            expect(fn).toBeDefined();
            expect(fn!()).toBe('hello');
        });

        it('resolves default export when no explicit name given', () => {
            const mod = { default: () => 'default-result' };
            const fn = resolveFunctionModuleExport({ mod });
            expect(fn).toBeDefined();
            expect(fn!()).toBe('default-result');
        });

        it('returns undefined for non-function export', () => {
            const mod = { myHandler: 'not-a-function' };
            const fn = resolveFunctionModuleExport({ mod, exportName: 'myHandler' });
            expect(fn).toBeUndefined();
        });

        it('returns undefined when export not found', () => {
            const mod = { other: () => {} };
            const fn = resolveFunctionModuleExport({ mod, exportName: 'missing' });
            expect(fn).toBeUndefined();
        });

        it('tries fallback export names', () => {
            const mod = { handler: () => 'fallback' };
            const fn = resolveFunctionModuleExport({ mod, fallbackExportNames: ['handler', 'default'] });
            expect(fn).toBeDefined();
            expect(fn!()).toBe('fallback');
        });

        it('uses "default" as fallback when no fallbackExportNames given', () => {
            const mod = {};
            const fn = resolveFunctionModuleExport({ mod });
            expect(fn).toBeUndefined();
        });
    });

    describe('buildImportUrl', () => {
        it('adds cache-bust for workspace source', () => {
            const url = buildImportUrl('/path/to/handler.ts', 'coreblow-workspace');
            expect(url).toMatch(/\?t=\d+$/);
        });

        it('adds cache-bust for managed source', () => {
            const url = buildImportUrl('/path/to/handler.ts', 'coreblow-managed');
            expect(url).toMatch(/\?t=\d+$/);
        });

        it('no cache-bust for bundled source', () => {
            const url = buildImportUrl('/path/to/handler.ts', 'coreblow-bundled');
            expect(url).not.toContain('?t=');
        });

        it('returns file:// URL', () => {
            const url = buildImportUrl('/path/to/handler.ts', 'coreblow-bundled');
            expect(url).toMatch(/^file:\/\//);
        });
    });
});
