// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { getBuiltinCommands } from './builtins.js';

describe('Command Builtins — Phase 12', () => {
    const builtins = getBuiltinCommands();

    it('returns an array of commands', () => {
        expect(Array.isArray(builtins)).toBe(true);
        expect(builtins.length).toBeGreaterThanOrEqual(8);
    });

    it('each command has required fields', () => {
        for (const cmd of builtins) {
            expect(cmd.name).toBeTruthy();
            expect(cmd.description).toBeTruthy();
            expect(cmd.category).toBeTruthy();
            expect(typeof cmd.handler).toBe('function');
        }
    });

    it('has help command with aliases', () => {
        const help = builtins.find(c => c.name === 'help');
        expect(help).toBeDefined();
        expect(help!.aliases).toContain('h');
        expect(help!.aliases).toContain('?');
    });

    it('has ping command', () => {
        const ping = builtins.find(c => c.name === 'ping');
        expect(ping).toBeDefined();
        expect(ping!.aliases).toContain('p');
    });

    it('ping returns pong', async () => {
        const ping = builtins.find(c => c.name === 'ping');
        const result = await ping!.handler({ command: { args: {} }, metadata: {}, sessionId: 's1', channel: 'test' });
        expect(result).toContain('Pong');
    });

    it('has version command', async () => {
        const version = builtins.find(c => c.name === 'version');
        const result = await version!.handler({ command: { args: {} }, metadata: {}, sessionId: 's1', channel: 'test' });
        expect(result).toContain('CoreBlow');
        expect(result).toContain('Node');
        expect(result).toContain('Platform');
    });

    it('has status command', async () => {
        const status = builtins.find(c => c.name === 'status');
        const result = await status!.handler({ command: { args: {} }, metadata: {}, sessionId: 's1', channel: 'discord' });
        expect(result).toContain('System Status');
        expect(result).toContain('Uptime');
    });

    it('has model command', async () => {
        const model = builtins.find(c => c.name === 'model');
        expect(model!.aliases).toContain('m');
        const noArg = await model!.handler({ command: { args: {} }, metadata: {}, sessionId: 's1', channel: 'test' });
        expect(noArg).toContain('/model');
        const withArg = await model!.handler({ command: { args: { name: 'gpt-4o' } }, metadata: {}, sessionId: 's1', channel: 'test' });
        expect(withArg).toContain('gpt-4o');
    });

    it('has persona command with subcommands', () => {
        const persona = builtins.find(c => c.name === 'persona');
        expect(persona).toBeDefined();
        expect(persona!.subcommands).toBeDefined();
        const subNames = persona!.subcommands!.map(s => s.name);
        expect(subNames).toContain('list');
        expect(subNames).toContain('set');
        expect(subNames).toContain('info');
    });

    it('has session command with subcommands', () => {
        const session = builtins.find(c => c.name === 'session');
        expect(session).toBeDefined();
        const subNames = session!.subcommands!.map(s => s.name);
        expect(subNames).toContain('clear');
        expect(subNames).toContain('info');
        expect(subNames).toContain('compress');
    });

    it('session clear returns confirmation', async () => {
        const session = builtins.find(c => c.name === 'session');
        const clear = session!.subcommands!.find(s => s.name === 'clear');
        const result = await clear!.handler({ command: { args: {} }, metadata: {}, sessionId: 's1', channel: 'test' });
        expect(result).toContain('cleared');
    });

    it('has fork and branches commands', () => {
        expect(builtins.find(c => c.name === 'fork')).toBeDefined();
        expect(builtins.find(c => c.name === 'branches')).toBeDefined();
    });

    it('has usage command with admin permission', () => {
        const usage = builtins.find(c => c.name === 'usage');
        expect(usage).toBeDefined();
        expect(usage!.permission).toBe('admin');
    });

    it('unique command names', () => {
        const names = builtins.map(c => c.name);
        expect(new Set(names).size).toBe(names.length);
    });
});
