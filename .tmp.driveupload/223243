import { describe, it, expect } from 'vitest';
import { splitArgsPreservingQuotes } from './arg-split.js';
import { parseKeyValueOutput } from './runtime-parse.js';
import { resolveHomeDir, resolveUserPathWithHome } from './paths.js';
import {
    normalizeGatewayProfile,
    resolveGatewayProfileSuffix,
    resolveGatewayLaunchAgentLabel,
    formatGatewayServiceDescription,
    formatNodeServiceDescription,
    GATEWAY_LAUNCH_AGENT_LABEL,
} from './constants.js';
import {
    assertNoCmdLineBreak,
    parseCmdSetAssignment,
    renderCmdSetAssignment,
} from './cmd-set.js';
import { quoteCmdScriptArg, unescapeCmdScriptArg, parseCmdScriptCommandLine } from './cmd-argv.js';

describe('Daemon Module', () => {
    describe('arg-split.ts: splitArgsPreservingQuotes', () => {
        it('splits simple arguments', () => {
            expect(splitArgsPreservingQuotes('a b c')).toEqual(['a', 'b', 'c']);
        });

        it('preserves quoted strings', () => {
            expect(splitArgsPreservingQuotes('say "hello world" now')).toEqual([
                'say', 'hello world', 'now',
            ]);
        });

        it('handles backslash escaping', () => {
            expect(
                splitArgsPreservingQuotes('path\\=val next', { escapeMode: 'backslash' }),
            ).toEqual(['path=val', 'next']);
        });

        it('handles backslash-quote-only escaping', () => {
            expect(
                splitArgsPreservingQuotes('arg \\"quoted\\"', { escapeMode: 'backslash-quote-only' }),
            ).toEqual(['arg', '"quoted"']);
        });

        it('returns empty array for empty string', () => {
            expect(splitArgsPreservingQuotes('')).toEqual([]);
        });

        it('handles multiple spaces between args', () => {
            expect(splitArgsPreservingQuotes('a   b   c')).toEqual(['a', 'b', 'c']);
        });
    });

    describe('runtime-parse.ts: parseKeyValueOutput', () => {
        it('parses key=value lines', () => {
            const result = parseKeyValueOutput('Name=CoreBlow\nVersion=1.0\n', '=');
            expect(result.name).toBe('CoreBlow');
            expect(result.version).toBe('1.0');
        });

        it('parses with colon separator', () => {
            const result = parseKeyValueOutput('Status: Running\nPID: 1234', ':');
            expect(result.status).toBe('Running');
            expect(result.pid).toBe('1234');
        });

        it('skips empty lines and lines without separator', () => {
            const result = parseKeyValueOutput('\n\nno-separator\nkey=value\n', '=');
            expect(Object.keys(result)).toEqual(['key']);
        });

        it('handles keys with spaces and normalizes to lowercase', () => {
            const result = parseKeyValueOutput('Display Name = CoreBlow', '=');
            expect(result['display name']).toBe('CoreBlow');
        });
    });

    describe('constants.ts', () => {
        it('normalizeGatewayProfile returns null for default', () => {
            expect(normalizeGatewayProfile(undefined)).toBeNull();
            expect(normalizeGatewayProfile('')).toBeNull();
            expect(normalizeGatewayProfile('default')).toBeNull();
            expect(normalizeGatewayProfile('Default')).toBeNull();
        });

        it('normalizeGatewayProfile returns trimmed profile name', () => {
            expect(normalizeGatewayProfile('staging')).toBe('staging');
            expect(normalizeGatewayProfile(' dev ')).toBe('dev');
        });

        it('resolveGatewayProfileSuffix returns empty for default', () => {
            expect(resolveGatewayProfileSuffix(undefined)).toBe('');
            expect(resolveGatewayProfileSuffix('default')).toBe('');
        });

        it('resolveGatewayProfileSuffix returns -suffix for profiles', () => {
            expect(resolveGatewayProfileSuffix('staging')).toBe('-staging');
        });

        it('resolveGatewayLaunchAgentLabel uses default for no profile', () => {
            expect(resolveGatewayLaunchAgentLabel()).toBe(GATEWAY_LAUNCH_AGENT_LABEL);
        });

        it('resolveGatewayLaunchAgentLabel uses profile in label', () => {
            expect(resolveGatewayLaunchAgentLabel('staging')).toBe('ai.coreblow.staging');
        });

        it('formatGatewayServiceDescription builds correct description', () => {
            expect(formatGatewayServiceDescription()).toBe('CoreBlow Gateway');
            expect(formatGatewayServiceDescription({ profile: 'staging' }))
                .toBe('CoreBlow Gateway (profile: staging)');
            expect(formatGatewayServiceDescription({ version: '2.0' }))
                .toBe('CoreBlow Gateway (v2.0)');
            expect(formatGatewayServiceDescription({ profile: 'dev', version: '1.0' }))
                .toBe('CoreBlow Gateway (profile: dev, v1.0)');
        });

        it('formatNodeServiceDescription', () => {
            expect(formatNodeServiceDescription()).toBe('CoreBlow Node Host');
            expect(formatNodeServiceDescription({ version: '3.0' })).toBe('CoreBlow Node Host (v3.0)');
        });
    });

    describe('paths.ts', () => {
        it('resolves HOME from env', () => {
            expect(resolveHomeDir({ HOME: '/home/user' })).toBe('/home/user');
        });

        it('resolves USERPROFILE when HOME is missing', () => {
            expect(resolveHomeDir({ USERPROFILE: 'C:\\Users\\user' })).toBe('C:\\Users\\user');
        });

        it('throws when both HOME and USERPROFILE are missing', () => {
            expect(() => resolveHomeDir({})).toThrow('Missing HOME');
        });

        it('resolveUserPathWithHome expands tilde', () => {
            const result = resolveUserPathWithHome('~/docs', '/home/user');
            expect(result).toContain('/home/user');
            expect(result).toContain('docs');
        });

        it('resolveUserPathWithHome throws on tilde without home', () => {
            expect(() => resolveUserPathWithHome('~/docs')).toThrow('Missing HOME');
        });

        it('resolveUserPathWithHome preserves Windows absolute paths', () => {
            expect(resolveUserPathWithHome('C:\\Users\\app')).toBe('C:\\Users\\app');
        });
    });

    describe('cmd-set.ts', () => {
        it('assertNoCmdLineBreak rejects CR/LF', () => {
            expect(() => assertNoCmdLineBreak('has\nbreak', 'field')).toThrow();
            expect(() => assertNoCmdLineBreak('has\rbreak', 'field')).toThrow();
        });

        it('assertNoCmdLineBreak passes clean values', () => {
            expect(() => assertNoCmdLineBreak('clean value', 'field')).not.toThrow();
        });

        it('parseCmdSetAssignment parses simple assignment', () => {
            expect(parseCmdSetAssignment('KEY=VALUE')).toEqual({ key: 'KEY', value: 'VALUE' });
        });

        it('parseCmdSetAssignment parses quoted assignment with unescaping', () => {
            const result = parseCmdSetAssignment('"FOO=bar%%baz"');
            expect(result).not.toBeNull();
            expect(result!.key).toBe('FOO');
            expect(result!.value).toBe('bar%baz');
        });

        it('parseCmdSetAssignment returns null for invalid', () => {
            expect(parseCmdSetAssignment('')).toBeNull();
            expect(parseCmdSetAssignment('no-equals')).toBeNull();
        });

        it('renderCmdSetAssignment produces escaped set statement', () => {
            const result = renderCmdSetAssignment('MY_VAR', 'hello%world');
            expect(result).toContain('set');
            expect(result).toContain('MY_VAR');
            expect(result).toContain('%%');
        });
    });

    describe('cmd-argv.ts', () => {
        it('quoteCmdScriptArg quotes arguments with special chars', () => {
            expect(quoteCmdScriptArg('hello world')).toBe('"hello world"');
            expect(quoteCmdScriptArg('')).toBe('""');
        });

        it('quoteCmdScriptArg rejects newlines', () => {
            expect(() => quoteCmdScriptArg('has\nnewline')).toThrow();
        });

        it('unescapeCmdScriptArg unescapes correctly', () => {
            expect(unescapeCmdScriptArg('hello%%world^!')).toBe('hello%world!');
        });

        it('parseCmdScriptCommandLine parses and unescapes', () => {
            const result = parseCmdScriptCommandLine('cmd /c "echo hello"');
            expect(result.length).toBeGreaterThanOrEqual(2);
            expect(result[0]).toBe('cmd');
        });
    });
});
