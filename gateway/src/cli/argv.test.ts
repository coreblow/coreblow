/**
 * cli/argv.test.ts — CLI argument parser tests
 */
import { describe, it, expect } from 'vitest';
import { parseArgv, normalizeFlag, buildArgv, extractBoolFlag, extractStringFlag } from './argv.js';

describe('CLI Argv', () => {
    describe('parseArgv', () => {
        it('parses command', () => {
            const r = parseArgv(['node', 'cli', 'start']);
            expect(r.command).toBe('start');
        });

        it('parses command + subcommand', () => {
            const r = parseArgv(['node', 'cli', 'config', 'show']);
            expect(r.command).toBe('config');
            expect(r.subcommand).toBe('show');
        });

        it('parses --flag value', () => {
            const r = parseArgv(['node', 'cli', '--port', '3000']);
            expect(r.flags.port).toBe('3000');
        });

        it('parses --flag=value', () => {
            const r = parseArgv(['node', 'cli', '--port=3000']);
            expect(r.flags.port).toBe('3000');
        });

        it('parses boolean flags', () => {
            const r = parseArgv(['node', 'cli', '--verbose', '--json']);
            expect(r.flags.verbose).toBe(true);
            expect(r.flags.json).toBe(true);
        });

        it('parses short flags', () => {
            const r = parseArgv(['node', 'cli', '-p', '3000', '-v']);
            expect(r.flags.p).toBe('3000');
            expect(r.flags.v).toBe(true);
        });

        it('handles -- separator', () => {
            const r = parseArgv(['node', 'cli', 'run', '--', '--not-a-flag']);
            // After --, items become positional: run is command, --not-a-flag is subcommand
            expect(r.command).toBe('run');
            expect(r.subcommand).toBe('--not-a-flag');
            expect(r.flags['not-a-flag']).toBeUndefined();
        });

        it('handles empty argv', () => {
            const r = parseArgv(['node', 'cli']);
            expect(r.command).toBe('');
        });
    });

    describe('normalizeFlag', () => {
        it('camelCases kebab-case', () => expect(normalizeFlag('max-retries')).toBe('maxRetries'));
        it('keeps camelCase', () => expect(normalizeFlag('maxRetries')).toBe('maxRetries'));
        it('handles single word', () => expect(normalizeFlag('port')).toBe('port'));
    });

    describe('buildArgv', () => {
        it('rebuilds argv', () => {
            const parsed = parseArgv(['node', 'cli', 'config', 'show', '--json']);
            const rebuilt = buildArgv(parsed);
            expect(rebuilt).toContain('config');
            expect(rebuilt).toContain('show');
            expect(rebuilt).toContain('--json');
        });
    });

    describe('extractBoolFlag', () => {
        it('extracts true', () => expect(extractBoolFlag({ verbose: true }, 'verbose')).toBe(true));
        it('extracts alias', () => expect(extractBoolFlag({ v: true }, 'verbose', 'v')).toBe(true));
        it('returns false when missing', () => expect(extractBoolFlag({}, 'verbose')).toBe(false));
    });

    describe('extractStringFlag', () => {
        it('extracts string', () => expect(extractStringFlag({ port: '3000' }, 'port')).toBe('3000'));
        it('extracts alias', () => expect(extractStringFlag({ p: '3000' }, 'port', 'p')).toBe('3000'));
        it('returns undefined for boolean', () => expect(extractStringFlag({ json: true }, 'json')).toBeUndefined());
    });
});
