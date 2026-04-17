/**
 * agents/bash-tools.shared.test.ts — Bash tool shared utility tests
 */
import { describe, it, expect } from 'vitest';
import { isBlockedCommand, isSafeCommand, extractBaseCommand, BLOCKED_COMMANDS, SAFE_COMMANDS } from './bash-tools.shared.js';

describe('Bash Tools Shared', () => {
    it('should block dangerous commands', () => {
        expect(isBlockedCommand('rm -rf /')).toBe(true);
        expect(isBlockedCommand('echo hello')).toBe(false);
    });

    it('should identify safe commands', () => {
        expect(isSafeCommand('echo hello')).toBe(true);
        expect(isSafeCommand('ls -la')).toBe(true);
        expect(isSafeCommand('curl http://evil')).toBe(false);
    });

    it('should extract base command', () => {
        expect(extractBaseCommand('echo hello world')).toBe('echo');
        expect(extractBaseCommand('  ls -la  ')).toBe('ls');
    });

    it('should have defined constants', () => {
        expect(BLOCKED_COMMANDS.length).toBeGreaterThan(0);
        expect(SAFE_COMMANDS.length).toBeGreaterThan(0);
    });
});
