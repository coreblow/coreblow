/**
 * tests/unit/gmail.test.ts
 * Gmail channel tests
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('Gmail Channel', () => {
    let GmailChannel: any;
    let parseEmailAddress: any;
    let htmlToText: any;
    let cleanEmailBody: any;
    let buildMimeMessage: any;
    let buildImapSearchCommand: any;

    beforeEach(async () => {
        const mod = await import('../../src/channels/gmail.js');
        GmailChannel = mod.GmailChannel;
        parseEmailAddress = mod.parseEmailAddress;
        htmlToText = mod.htmlToText;
        cleanEmailBody = mod.cleanEmailBody;
        buildMimeMessage = mod.buildMimeMessage;
        buildImapSearchCommand = mod.buildImapSearchCommand;
    });

    // ── Email Parsing ──

    it('should parse email with name', () => {
        const result = parseEmailAddress('John Doe <john@example.com>');
        expect(result.name).toBe('John Doe');
        expect(result.email).toBe('john@example.com');
    });

    it('should parse email with quoted name', () => {
        const result = parseEmailAddress('"Jane Smith" <jane@example.com>');
        expect(result.name).toBe('Jane Smith');
        expect(result.email).toBe('jane@example.com');
    });

    it('should parse plain email', () => {
        const result = parseEmailAddress('user@example.com');
        expect(result.email).toBe('user@example.com');
    });

    // ── HTML to Text ──

    it('should convert HTML to text', () => {
        const text = htmlToText('<p>Hello <b>world</b></p><br>Line 2');
        expect(text).toContain('Hello world');
        expect(text).toContain('Line 2');
    });

    it('should strip scripts and styles', () => {
        const text = htmlToText('<style>.foo{}</style><script>alert(1)</script>Hello');
        expect(text).toBe('Hello');
    });

    it('should decode HTML entities', () => {
        const text = htmlToText('A &amp; B &lt; C &gt; D &quot;E&quot;');
        expect(text).toBe('A & B < C > D "E"');
    });

    // ── Email Body Cleaning ──

    it('should remove quoted replies', () => {
        const body = 'My response here.\n\nOn Mon, Jan 1 wrote:\n> Original message';
        const cleaned = cleanEmailBody(body);
        expect(cleaned).toBe('My response here.');
    });

    it('should remove signatures', () => {
        const body = 'Hello there.\n-- \nJohn Doe\nCEO';
        const cleaned = cleanEmailBody(body);
        expect(cleaned).toBe('Hello there.');
    });

    it('should remove mobile signatures', () => {
        const body = 'Quick reply.\n\nSent from my iPhone';
        const cleaned = cleanEmailBody(body);
        expect(cleaned).toBe('Quick reply.');
    });

    it('should skip quoted lines', () => {
        const body = 'My reply.\n> Previous text\n> More previous';
        const cleaned = cleanEmailBody(body);
        expect(cleaned).toBe('My reply.');
    });

    // ── MIME Building ──

    it('should build plain text MIME message', () => {
        const mime = buildMimeMessage({
            from: 'bot@example.com',
            to: 'user@example.com',
            subject: 'Test',
            body: 'Hello world',
        });
        expect(mime).toContain('From: bot@example.com');
        expect(mime).toContain('To: user@example.com');
        expect(mime).toContain('Subject: Test');
        expect(mime).toContain('Hello world');
        expect(mime).toContain('text/plain');
    });

    it('should build HTML MIME message', () => {
        const mime = buildMimeMessage({
            from: 'bot@example.com',
            to: 'user@example.com',
            subject: 'Test',
            body: '<p>Hello</p>',
            html: true,
        });
        expect(mime).toContain('multipart/alternative');
        expect(mime).toContain('text/html');
    });

    it('should include reply headers', () => {
        const mime = buildMimeMessage({
            from: 'bot@example.com',
            to: 'user@example.com',
            subject: 'Re: Test',
            body: 'Reply',
            inReplyTo: '<abc@example.com>',
            references: '<abc@example.com>',
        });
        expect(mime).toContain('In-Reply-To: <abc@example.com>');
        expect(mime).toContain('References: <abc@example.com>');
    });

    // ── IMAP Commands ──

    it('should build search command for unread', () => {
        const cmd = buildImapSearchCommand(['INBOX'], true);
        expect(cmd).toContain('SEARCH');
        expect(cmd).toContain('UNSEEN');
    });

    it('should build search command without unread filter', () => {
        const cmd = buildImapSearchCommand(['INBOX'], false);
        expect(cmd).toBe('SEARCH');
    });

    it('should include labels in search', () => {
        const cmd = buildImapSearchCommand(['INBOX', 'Important'], true);
        expect(cmd).toContain('X-GM-LABELS');
        expect(cmd).toContain('Important');
    });

    // ── Channel Lifecycle ──

    it('should create with config', () => {
        const ch = new GmailChannel({ email: 'test@gmail.com', appPassword: 'xxxx' });
        expect(ch.name).toBe('gmail');
        expect(ch.isConnected()).toBe(false);
    });

    it('should report status', () => {
        const ch = new GmailChannel({ email: 'test@gmail.com', appPassword: 'xxxx' });
        const status = ch.getStatus();
        expect(status.name).toBe('gmail');
        expect(status.details.email).toBe('test@gmail.com');
        expect(status.details.sent).toBe(0);
        expect(status.details.received).toBe(0);
    });

    it('should not start without credentials', async () => {
        const ch = new GmailChannel({ email: '', appPassword: '' });
        const mockRouter = {
            registerChannelSender: () => { },
            routeInbound: async () => { },
        } as any;
        await ch.start(mockRouter);
        expect(ch.isConnected()).toBe(false);
    });

    it('should apply default config', () => {
        const ch = new GmailChannel({ email: 'x@gmail.com', appPassword: 'y' });
        const status = ch.getStatus();
        expect(status.details.labels).toEqual(['INBOX']);
    });
});
