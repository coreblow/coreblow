/**
 * cli/completion.test.ts — Shell completion tests
 */
import { describe, it, expect } from 'vitest';
import { generateCompletion, detectShell } from './completion.js';

describe('Shell Completion', () => {
    it('generates bash completion', () => {
        const result = generateCompletion('bash');
        expect(result).toContain('_coreblow');
        expect(result).toContain('complete');
        expect(result).toContain('start');
        expect(result).toContain('config');
    });

    it('generates zsh completion', () => {
        const result = generateCompletion('zsh');
        expect(result).toContain('#compdef');
        expect(result).toContain('coreblow');
    });

    it('generates fish completion', () => {
        const result = generateCompletion('fish');
        expect(result).toContain('complete -c coreblow');
        expect(result).toContain('start');
    });

    it('detectShell returns a shell', () => {
        const shell = detectShell();
        expect(['bash', 'zsh', 'fish']).toContain(shell);
    });
});
