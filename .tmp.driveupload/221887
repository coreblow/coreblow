import { describe, it, expect, beforeEach } from 'vitest';
import { CommandParser } from './command-parser.js';
import { renderMarkdownToTerminal, highlightCode, formatCodeBlock } from './output-formatter.js';
import { CLIBanner } from './cli-banner.js';

describe('CLI Module', () => {
    describe('command-parser.ts: CommandParser', () => {
        let parser: CommandParser;

        beforeEach(() => {
            parser = new CommandParser('/');
        });

        it('detects commands from prefix', () => {
            expect(parser.isCommand('/help')).toBe(true);
            expect(parser.isCommand('  /status')).toBe(true);
            expect(parser.isCommand('hello world')).toBe(false);
        });

        it('parses simple command', () => {
            const parsed = parser.parse('/help');
            expect(parsed).not.toBeNull();
            expect(parsed!.command).toBe('help');
            expect(parsed!.args).toEqual([]);
        });

        it('parses command with arguments', () => {
            const parsed = parser.parse('/persona coder');
            expect(parsed!.command).toBe('persona');
            expect(parsed!.args).toEqual(['coder']);
        });

        it('resolves aliases', () => {
            const parsed = parser.parse('/h');
            expect(parsed!.command).toBe('help');

            const exitParsed = parser.parse('/q');
            expect(exitParsed!.command).toBe('quit');

            const cfgParsed = parser.parse('/cfg');
            expect(cfgParsed!.command).toBe('config');
        });

        it('parses long flags (--flag and --flag=value)', () => {
            const parsed = parser.parse('/export --format=json --verbose');
            expect(parsed!.flags['format']).toBe('json');
            expect(parsed!.flags['verbose']).toBe(true);
        });

        it('parses short flags with value', () => {
            const parsed = parser.parse('/export -f markdown');
            expect(parsed!.flags['format']).toBe('markdown');
        });

        it('handles quoted arguments', () => {
            const parsed = parser.parse('/model "gpt-4o mini"');
            expect(parsed!.args).toEqual(['gpt-4o mini']);
        });

        it('returns null for non-commands', () => {
            expect(parser.parse('hello')).toBeNull();
            expect(parser.parse('')).toBeNull();
        });

        it('returns null for just prefix', () => {
            expect(parser.parse('/')).toBeNull();
        });

        it('registers custom commands', () => {
            parser.register({
                name: 'custom',
                description: 'A custom command',
                aliases: ['c'],
            });
            const parsed = parser.parse('/c');
            expect(parsed!.command).toBe('custom');
        });

        it('executes command with handler', async () => {
            parser.register({
                name: 'ping',
                description: 'Ping',
                handler: async () => 'pong',
            });
            const result = await parser.execute('/ping');
            expect(result).toBe('pong');
        });

        it('executes unknown command gracefully', async () => {
            const result = await parser.execute('/nonexistent');
            expect(result).toContain('Unknown command');
        });

        it('generates help text', () => {
            const help = parser.generateHelp();
            expect(help).toContain('Available Commands');
            expect(help).toContain('/help');
            expect(help).toContain('/quit');
        });

        it('lists commands with count', () => {
            const list = parser.list();
            expect(list.length).toBe(parser.count());
            expect(list.some(c => c.name === 'help')).toBe(true);
        });

        it('getCommand by name or alias', () => {
            expect(parser.getCommand('help')).not.toBeNull();
            expect(parser.getCommand('h')).not.toBeNull();
            expect(parser.getCommand('nonexistent')).toBeNull();
        });
    });

    describe('output-formatter.ts', () => {
        it('renders bold markdown', () => {
            const output = renderMarkdownToTerminal('**bold text**');
            expect(output).toContain('bold text');
            expect(output).toContain('\x1b[1m'); // bold ANSI code
        });

        it('renders italic markdown', () => {
            const output = renderMarkdownToTerminal('*italic text*');
            expect(output).toContain('\x1b[3m'); // italic ANSI code
        });

        it('renders headers', () => {
            expect(renderMarkdownToTerminal('# Title')).toContain('Title');
            expect(renderMarkdownToTerminal('## Subtitle')).toContain('Subtitle');
            expect(renderMarkdownToTerminal('### Sub-sub')).toContain('Sub-sub');
        });

        it('renders bullet points', () => {
            expect(renderMarkdownToTerminal('- item')).toContain('•');
            expect(renderMarkdownToTerminal('* item')).toContain('•');
        });

        it('renders horizontal rules', () => {
            expect(renderMarkdownToTerminal('---')).toContain('─');
        });

        it('highlightCode adds ANSI sequences', () => {
            const code = 'const x = 42;';
            const highlighted = highlightCode(code, 'typescript');
            expect(highlighted).toContain('\x1b['); // has ANSI codes
            expect(highlighted).toContain('const');
        });

        it('formatCodeBlock adds line numbers', () => {
            const block = formatCodeBlock('line1\nline2', 'typescript');
            expect(block).toContain('1');
            expect(block).toContain('2');
            expect(block).toContain('typescript');
        });
    });

    describe('cli-banner.ts: CLIBanner', () => {
        it('generates default banner', () => {
            const banner = CLIBanner.generate();
            expect(banner).toContain('CoreBlow');
            expect(banner).toContain('1.0.0');
            expect(banner).toContain('Ready');
        });

        it('generates banner with custom options', () => {
            const banner = CLIBanner.generate({
                version: '2.5.0',
                agentName: 'TestBot',
                provider: 'anthropic',
                model: 'claude-3',
                channels: ['discord', 'telegram'],
                plugins: 5,
                skills: 12,
                port: 8080,
            });
            expect(banner).toContain('2.5.0');
            expect(banner).toContain('TestBot');
            expect(banner).toContain('anthropic');
            expect(banner).toContain('8080');
        });

        it('statusLine formats uptime and stats', () => {
            const line = CLIBanner.statusLine({ uptime: 3661000, requests: 42, errors: 2 });
            expect(line).toContain('1h');
            expect(line).toContain('42 req');
            expect(line).toContain('2 err');
        });

        it('formatUptime handles all ranges', () => {
            expect(CLIBanner.formatUptime(5000)).toBe('5s');
            expect(CLIBanner.formatUptime(125000)).toBe('2m 5s');
            expect(CLIBanner.formatUptime(3661000)).toBe('1h 1m');
            expect(CLIBanner.formatUptime(90061000)).toBe('1d 1h');
        });

        it('helpText lists commands', () => {
            const help = CLIBanner.helpText();
            expect(help).toContain('/help');
            expect(help).toContain('/quit');
        });

        it('label/dim/success/error produce ANSI strings', () => {
            expect(CLIBanner.label('test')).toContain('\x1b[');
            expect(CLIBanner.dim('test')).toContain('\x1b[2m');
            expect(CLIBanner.success('ok')).toContain('\x1b[32m');
            expect(CLIBanner.error('bad')).toContain('\x1b[31m');
        });
    });
});
