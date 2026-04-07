// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { BrowserTool, createBrowserToolDefinition } from './browser.js';
import { parseUnifiedDiff, applyPatchToContent, type FilePatch } from './apply-patch.js';
import { CrossChannelMessenger, createMessageToolDefinition } from './message.js';

describe('Phase 5 — Builtin Tools', () => {

    // ─── Browser Tool ──────────────────────────────────────────

    describe('BrowserTool', () => {
        let browser: BrowserTool;

        beforeEach(() => {
            browser = new BrowserTool();
        });

        it('initializes with defaults', () => {
            expect(browser.isConnected()).toBe(false);
            expect(browser.listPages()).toEqual([]);
        });

        it('navigate adds a page', async () => {
            const result = await browser.navigate('https://example.com');
            expect(result.url).toBe('https://example.com');
            expect(result.status).toBe(200);
            expect(browser.listPages()).toHaveLength(1);
        });

        it('navigate blocks non-http protocols', async () => {
            await expect(browser.navigate('file:///etc/passwd')).rejects.toThrow('Blocked protocol');
        });

        it('navigate blocks private IPs', async () => {
            await expect(browser.navigate('http://192.168.1.1/admin')).rejects.toThrow('Blocked private IP');
            await expect(browser.navigate('http://10.0.0.1/secret')).rejects.toThrow('Blocked private IP');
        });

        it('screenshot throws for unknown page', async () => {
            await expect(browser.screenshot('nonexistent')).rejects.toThrow('not found');
        });

        it('extractDOM throws for unknown page', async () => {
            await expect(browser.extractDOM('nonexistent')).rejects.toThrow('not found');
        });

        it('evaluate blocks dangerous patterns', async () => {
            await browser.navigate('https://example.com', 'p1');
            const result = await browser.evaluate('p1', 'require("child_process")');
            expect(result.error).toContain('Blocked pattern');
        });

        it('closePage removes page', async () => {
            await browser.navigate('https://example.com', 'p1');
            expect(browser.listPages()).toHaveLength(1);
            browser.closePage('p1');
            expect(browser.listPages()).toHaveLength(0);
        });

        it('enforces maxPages limit', async () => {
            const b = new BrowserTool({ maxPages: 2 });
            await b.navigate('https://a.com', 'a');
            await b.navigate('https://b.com', 'b');
            await b.navigate('https://c.com', 'c');
            expect(b.listPages()).toHaveLength(2);
        });

        it('createBrowserToolDefinition produces valid tool', () => {
            const def = createBrowserToolDefinition(browser);
            expect(def.name).toBe('browser');
            expect(def.category).toBe('web');
            expect(def.parameters.properties.action).toBeDefined();
            expect(typeof def.handler).toBe('function');
        });
    });

    // ─── Apply Patch Tool ──────────────────────────────────────

    describe('Apply Patch — parseUnifiedDiff', () => {
        const simpleDiff = [
            '--- a/file.txt',
            '+++ b/file.txt',
            '@@ -1,3 +1,3 @@',
            ' line 1',
            '-line 2',
            '+line 2 modified',
            ' line 3',
        ].join('\n');

        it('parses a simple diff', () => {
            const patches = parseUnifiedDiff(simpleDiff);
            expect(patches).toHaveLength(1);
            expect(patches[0]!.oldPath).toBe('a/file.txt');
            expect(patches[0]!.newPath).toBe('b/file.txt');
            expect(patches[0]!.hunks).toHaveLength(1);
            expect(patches[0]!.hunks[0]!.oldStart).toBe(1);
            expect(patches[0]!.hunks[0]!.oldLines).toBe(3);
        });

        it('detects new file', () => {
            const newFileDiff = [
                '--- /dev/null',
                '+++ b/new.txt',
                '@@ -0,0 +1,2 @@',
                '+hello',
                '+world',
            ].join('\n');
            const patches = parseUnifiedDiff(newFileDiff);
            expect(patches[0]!.isNew).toBe(true);
        });

        it('detects deleted file', () => {
            const deleteDiff = [
                '--- a/old.txt',
                '+++ /dev/null',
                '@@ -1,2 +0,0 @@',
                '-goodbye',
                '-world',
            ].join('\n');
            const patches = parseUnifiedDiff(deleteDiff);
            expect(patches[0]!.isDeleted).toBe(true);
        });

        it('parses multiple files', () => {
            const multiDiff = [
                '--- a/file1.txt',
                '+++ b/file1.txt',
                '@@ -1 +1 @@',
                '-old',
                '+new',
                '--- a/file2.txt',
                '+++ b/file2.txt',
                '@@ -1 +1 @@',
                '-foo',
                '+bar',
            ].join('\n');
            const patches = parseUnifiedDiff(multiDiff);
            expect(patches).toHaveLength(2);
        });
    });

    describe('Apply Patch — applyPatchToContent', () => {
        it('applies a simple substitution', () => {
            const original = 'line 1\nline 2\nline 3';
            const hunks = [{
                oldStart: 1,
                oldLines: 3,
                newStart: 1,
                newLines: 3,
                lines: [' line 1', '-line 2', '+line 2 modified', ' line 3'],
            }];
            const result = applyPatchToContent(original, hunks);
            expect(result.success).toBe(true);
            expect(result.result).toContain('line 2 modified');
            expect(result.result).not.toContain('\nline 2\n');
        });

        it('applies addition', () => {
            const original = 'a\nc';
            const hunks = [{
                oldStart: 1,
                oldLines: 2,
                newStart: 1,
                newLines: 3,
                lines: [' a', '+b', ' c'],
            }];
            const result = applyPatchToContent(original, hunks);
            expect(result.success).toBe(true);
            expect(result.result).toBe('a\nb\nc');
        });

        it('applies deletion', () => {
            const original = 'a\nb\nc';
            const hunks = [{
                oldStart: 1,
                oldLines: 3,
                newStart: 1,
                newLines: 2,
                lines: [' a', '-b', ' c'],
            }];
            const result = applyPatchToContent(original, hunks);
            expect(result.success).toBe(true);
            expect(result.result).toBe('a\nc');
        });

        it('handles empty hunks', () => {
            const original = 'hello\nworld';
            const result = applyPatchToContent(original, []);
            expect(result.success).toBe(true);
            expect(result.result).toBe('hello\nworld');
        });
    });

    // ─── Cross-Channel Message Tool ────────────────────────────

    describe('CrossChannelMessenger', () => {
        let messenger: CrossChannelMessenger;

        beforeEach(() => {
            messenger = new CrossChannelMessenger();
        });

        it('initializes with no channels', () => {
            expect(messenger.listChannels()).toEqual([]);
        });

        it('registers and lists adapters', () => {
            messenger.registerAdapter({
                id: 'discord',
                name: 'Discord',
                connect: async () => {},
                disconnect: async () => {},
                health: async () => ({ connected: true }),
                send: async () => ({ success: true, messageId: '1' }),
                onMessage: () => {},
            } as any);
            expect(messenger.listChannels()).toContain('discord');
        });

        it('unregisters adapter', () => {
            messenger.registerAdapter({ id: 'slack', name: 'Slack', send: async () => ({ success: true }), onMessage: () => {} } as any);
            expect(messenger.listChannels()).toContain('slack');
            messenger.unregisterAdapter('slack');
            expect(messenger.listChannels()).not.toContain('slack');
        });

        it('sendToOne fails without adapter', async () => {
            const report = await messenger.sendToOne('discord', 'user1', 'hello');
            expect(report.success).toBe(false);
            expect(report.error).toContain('No adapter');
        });

        it('sendToOne succeeds with adapter', async () => {
            messenger.registerAdapter({
                id: 'telegram',
                name: 'Telegram',
                send: async () => ({ success: true, messageId: 'msg1' }),
                onMessage: () => {},
            } as any);
            const report = await messenger.sendToOne('telegram', '12345', 'hello');
            expect(report.success).toBe(true);
            expect(report.messageId).toBe('msg1');
            expect(report.deliveredAt).toBeGreaterThan(0);
        });

        it('send to multiple targets', async () => {
            messenger.registerAdapter({
                id: 'discord',
                name: 'Discord',
                send: async () => ({ success: true, messageId: 'd1' }),
                onMessage: () => {},
            } as any);
            messenger.registerAdapter({
                id: 'slack',
                name: 'Slack',
                send: async () => ({ success: true, messageId: 's1' }),
                onMessage: () => {},
            } as any);
            const result = await messenger.send({
                targets: [
                    { channel: 'discord', to: 'ch1' },
                    { channel: 'slack', to: '#general' },
                ],
                text: 'announcement',
            });
            expect(result.totalTargets).toBe(2);
            expect(result.delivered).toBe(2);
            expect(result.failed).toBe(0);
        });

        it('handles partial failure', async () => {
            messenger.registerAdapter({
                id: 'discord',
                name: 'Discord',
                send: async () => ({ success: true, messageId: 'd1' }),
                onMessage: () => {},
            } as any);
            // No Slack adapter registered
            const result = await messenger.send({
                targets: [
                    { channel: 'discord', to: 'ch1' },
                    { channel: 'slack', to: '#general' },
                ],
                text: 'hello',
            });
            expect(result.delivered).toBe(1);
            expect(result.failed).toBe(1);
        });

        it('createMessageToolDefinition produces valid tool', () => {
            const def = createMessageToolDefinition(messenger);
            expect(def.name).toBe('message');
            expect(def.category).toBe('messaging');
            expect(def.parameters.required).toContain('channel');
            expect(def.parameters.required).toContain('to');
            expect(def.parameters.required).toContain('text');
        });
    });
});
