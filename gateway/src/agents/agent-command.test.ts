/**
 * Tests for CoreBlow Agent Command Handler
 */

import { describe, it, expect } from 'vitest';
import {
    parseCommand,
    resolveCommandName,
    getCommand,
    listCommands,
    executeCommand,
    type CommandContext,
} from './agent-command.js';

const mockContext: CommandContext = {
    sessionId: 'test-session-001',
    agentId: 'default',
    cfg: {},
    currentModel: { provider: 'anthropic', model: 'claude-sonnet-4-5' },
    userTimezone: 'Asia/Jakarta',
};

describe('parseCommand', () => {
    it('should parse slash commands', () => {
        const result = parseCommand('/help');
        expect(result).toEqual({ name: 'help', args: [] });
    });

    it('should parse commands with arguments', () => {
        const result = parseCommand('/model openai/gpt-4o');
        expect(result).toEqual({ name: 'model', args: ['openai/gpt-4o'] });
    });

    it('should parse multiple arguments', () => {
        const result = parseCommand('/config set key value');
        expect(result).toEqual({ name: 'config', args: ['set', 'key', 'value'] });
    });

    it('should return null for non-command input', () => {
        expect(parseCommand('hello world')).toBeNull();
        expect(parseCommand('')).toBeNull();
    });

    it('should be case insensitive for command name', () => {
        const result = parseCommand('/HELP');
        expect(result!.name).toBe('help');
    });
});

describe('resolveCommandName', () => {
    it('should resolve direct command names', () => {
        expect(resolveCommandName('help')).toBe('help');
        expect(resolveCommandName('status')).toBe('status');
    });

    it('should resolve aliases', () => {
        expect(resolveCommandName('h')).toBe('help');
        expect(resolveCommandName('?')).toBe('help');
        expect(resolveCommandName('s')).toBe('status');
        expect(resolveCommandName('m')).toBe('model');
    });

    it('should return undefined for unknown commands', () => {
        expect(resolveCommandName('nonexistent')).toBeUndefined();
    });
});

describe('getCommand', () => {
    it('should get registered commands', () => {
        const cmd = getCommand('help');
        expect(cmd).toBeDefined();
        expect(cmd!.name).toBe('help');
        expect(cmd!.description).toContain('available commands');
    });

    it('should get commands by alias', () => {
        const cmd = getCommand('h');
        expect(cmd).toBeDefined();
        expect(cmd!.name).toBe('help');
    });
});

describe('listCommands', () => {
    it('should list all commands', () => {
        const cmds = listCommands();
        expect(cmds.length).toBeGreaterThan(5);
    });

    it('should filter by category', () => {
        const modelCmds = listCommands('model');
        expect(modelCmds.every((c) => c.category === 'model')).toBe(true);
    });
});

describe('executeCommand', () => {
    it('should execute /help', async () => {
        const result = await executeCommand('/help', mockContext);
        expect(result.success).toBe(true);
        expect(result.output).toContain('Available Commands');
    });

    it('should execute /status', async () => {
        const result = await executeCommand('/status', mockContext);
        expect(result.success).toBe(true);
        expect(result.output).toContain('Session Status');
        expect(result.output).toContain('test-session-001');
        expect(result.output).toContain('anthropic/claude-sonnet-4-5');
    });

    it('should execute /model without args (show current)', async () => {
        const result = await executeCommand('/model', mockContext);
        expect(result.success).toBe(true);
        expect(result.output).toContain('anthropic/claude-sonnet-4-5');
    });

    it('should execute /model with new model', async () => {
        const result = await executeCommand('/model openai/gpt-4o', mockContext);
        expect(result.success).toBe(true);
        expect(result.output).toContain('openai/gpt-4o');
        expect(result.metadata).toHaveProperty('newModel');
    });

    it('should execute /reasoning', async () => {
        const result = await executeCommand('/reasoning on', mockContext);
        expect(result.success).toBe(true);
        expect(result.output).toContain('on');
    });

    it('should reject invalid reasoning mode', async () => {
        const result = await executeCommand('/reasoning invalid', mockContext);
        expect(result.success).toBe(false);
    });

    it('should execute /reset', async () => {
        const result = await executeCommand('/reset', mockContext);
        expect(result.success).toBe(true);
        expect(result.metadata).toEqual({ action: 'reset' });
    });

    it('should execute /compact', async () => {
        const result = await executeCommand('/compact', mockContext);
        expect(result.success).toBe(true);
        expect(result.metadata).toEqual({ action: 'compact' });
    });

    it('should execute /elevated', async () => {
        const result = await executeCommand('/elevated full', mockContext);
        expect(result.success).toBe(true);
        expect(result.metadata).toEqual({ elevated: 'full' });
    });

    it('should execute /doctor', async () => {
        const result = await executeCommand('/doctor', mockContext);
        expect(result.success).toBe(true);
        expect(result.output).toContain('Diagnostics');
    });

    it('should handle unknown commands', async () => {
        const result = await executeCommand('/nonexistent', mockContext);
        expect(result.success).toBe(false);
        expect(result.output).toContain('Unknown command');
    });

    it('should handle non-command input', async () => {
        const result = await executeCommand('hello', mockContext);
        expect(result.success).toBe(false);
        expect(result.output).toContain('Invalid command format');
    });

    it('should execute /config get', async () => {
        const result = await executeCommand('/config get agents.defaults.model', mockContext);
        expect(result.success).toBe(true);
        expect(result.metadata?.action).toBe('config.get');
    });

    it('should execute /gateway status', async () => {
        const result = await executeCommand('/gateway status', mockContext);
        expect(result.success).toBe(true);
        expect(result.metadata?.action).toBe('gateway.status');
    });
});
