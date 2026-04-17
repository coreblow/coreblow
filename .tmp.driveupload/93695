/**
 * Tests: Sandbox — SandboxExecutor (vm.createContext based)
 */
import { describe, it, expect } from 'vitest';
import { SandboxExecutor } from '../../src/sandbox/sandbox.js';

describe('SandboxExecutor', () => {
    it('creates with defaults', () => {
        const sb = new SandboxExecutor();
        expect(sb).toBeDefined();
    });

    // Sandbox captures console.log in output, returnValue has the expression result
    it('returns value of expression', () => {
        const sb = new SandboxExecutor();
        const result = sb.execute('2 + 2');
        expect(result.success).toBe(true);
        expect(result.returnValue).toBe(4);
    });

    it('captures console.log in output', () => {
        const sb = new SandboxExecutor();
        const result = sb.execute('console.log("hello")');
        expect(result.success).toBe(true);
        expect(result.output).toContain('hello');
    });

    it('executes string operations', () => {
        const sb = new SandboxExecutor();
        const result = sb.execute('"hello".toUpperCase()');
        expect(result.success).toBe(true);
        expect(result.returnValue).toBe('HELLO');
    });

    it('executes math functions', () => {
        const sb = new SandboxExecutor();
        const result = sb.execute('Math.sqrt(144)');
        expect(result.success).toBe(true);
        expect(result.returnValue).toBe(12);
    });

    it('provides extra context', () => {
        const sb = new SandboxExecutor();
        const result = sb.execute('myVar + 10', { myVar: 32 });
        expect(result.success).toBe(true);
        expect(result.returnValue).toBe(42);
    });

    it('cannot access require', () => {
        const sb = new SandboxExecutor();
        const result = sb.execute("require('fs')");
        expect(result.success).toBe(false);
    });

    it('cannot access process', () => {
        const sb = new SandboxExecutor();
        const result = sb.execute('process.env');
        expect(result.success).toBe(false);
    });

    it('handles syntax errors', () => {
        const sb = new SandboxExecutor();
        const result = sb.execute('function(');
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
    });

    it('handles timeout on infinite loops', () => {
        const sb = new SandboxExecutor({ timeoutMs: 100 });
        const result = sb.execute('while(true){}');
        expect(result.success).toBe(false);
    });

    it('captures multiple console.log calls', () => {
        const sb = new SandboxExecutor();
        const result = sb.execute('console.log("a"); console.log("b"); "done"');
        expect(result.success).toBe(true);
        expect(result.output).toContain('a');
        expect(result.output).toContain('b');
    });
});
