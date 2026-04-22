/**
 * CoreBlow — Group Activation Tests
 *
 * Tests for normalizeGroupActivation and parseActivationCommand.
 */

import { describe, it, expect } from 'vitest';
import { normalizeGroupActivation, parseActivationCommand } from './group-activation.js';

describe('normalizeGroupActivation', () => {
    it('normalizes "mention"', () => {
        expect(normalizeGroupActivation('mention')).toBe('mention');
        expect(normalizeGroupActivation('MENTION')).toBe('mention');
        expect(normalizeGroupActivation('  Mention  ')).toBe('mention');
    });

    it('normalizes "always"', () => {
        expect(normalizeGroupActivation('always')).toBe('always');
        expect(normalizeGroupActivation('ALWAYS')).toBe('always');
    });

    it('returns undefined for unknown', () => {
        expect(normalizeGroupActivation('other')).toBeUndefined();
        expect(normalizeGroupActivation('')).toBeUndefined();
        expect(normalizeGroupActivation(null)).toBeUndefined();
        expect(normalizeGroupActivation(undefined)).toBeUndefined();
    });
});

describe('parseActivationCommand', () => {
    it('parses /activation mention', () => {
        const result = parseActivationCommand('/activation mention');
        expect(result.hasCommand).toBe(true);
        expect(result.mode).toBe('mention');
    });

    it('parses /activation always', () => {
        const result = parseActivationCommand('/activation always');
        expect(result.hasCommand).toBe(true);
        expect(result.mode).toBe('always');
    });

    it('parses /activation without mode', () => {
        const result = parseActivationCommand('/activation');
        expect(result.hasCommand).toBe(true);
        expect(result.mode).toBeUndefined();
    });

    it('handles colon syntax /activation:mention', () => {
        const result = parseActivationCommand('/activation:mention');
        expect(result.hasCommand).toBe(true);
        expect(result.mode).toBe('mention');
    });

    it('returns hasCommand=false for non-activation', () => {
        expect(parseActivationCommand('/status')).toEqual({ hasCommand: false });
        expect(parseActivationCommand('hello')).toEqual({ hasCommand: false });
    });

    it('returns hasCommand=false for empty/null', () => {
        expect(parseActivationCommand('')).toEqual({ hasCommand: false });
        expect(parseActivationCommand(undefined)).toEqual({ hasCommand: false });
    });
});
