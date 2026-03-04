/**
 * src/hooks/email.ts
 * Universal Email Hook — Gmail API + any IMAP inbox
 * Superior to OpenClaw: supports ALL email providers, not just Gmail
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('hooks:email');

export interface EmailMessage {
    id: string;
    from: string;
    to: string[];
    subject: string;
    body: string;
    html?: string;
    date: Date;
    attachments: EmailAttachment[];
    labels?: string[];
    threadId?: string;
}

export interface EmailAttachment {
    filename: string;
    mimeType: string;
    size: number;
    content?: Buffer;
}

export interface EmailFilter {
    from?: string | RegExp;
    subject?: string | RegExp;
    hasAttachment?: boolean;
    label?: string;
    after?: Date;
}

export type EmailHandler = (email: EmailMessage) => Promise<void>;

export interface EmailWatcherConfig {
    provider: 'gmail' | 'imap';
    // Gmail-specific
    gmailCredentials?: {
        clientId: string;
        clientSecret: string;
        refreshToken: string;
    };
    // IMAP-specific (Outlook, Yahoo, custom)
    imap?: {
        host: string;
        port: number;
        user: string;
        password: string;
        tls: boolean;
    };
    pollIntervalMs?: number;
    filters?: EmailFilter[];
}

export class EmailWatcher {
    private config: EmailWatcherConfig;
    private handlers: EmailHandler[] = [];
    private interval: NodeJS.Timeout | null = null;
    private lastChecked: Date;
    private processedIds = new Set<string>();
    private running = false;

    constructor(config: EmailWatcherConfig) {
        this.config = config;
        this.lastChecked = new Date();
    }

    onNewEmail(handler: EmailHandler): void {
        this.handlers.push(handler);
    }

    async start(): Promise<void> {
        if (this.running) return;
        this.running = true;

        const pollMs = this.config.pollIntervalMs || 30_000; // 30s default

        log.info({
            provider: this.config.provider,
            pollMs,
            filters: this.config.filters?.length || 0,
        }, 'Email watcher started');

        // Initial check
        await this.check().catch(err => log.error({ err: err.message }, 'Initial email check failed'));

        // Recurring poll
        this.interval = setInterval(() => {
            this.check().catch(err => log.error({ err: err.message }, 'Email check failed'));
        }, pollMs);
    }

    async stop(): Promise<void> {
        this.running = false;
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        log.info('Email watcher stopped');
    }

    private async check(): Promise<void> {
        const emails = this.config.provider === 'gmail'
            ? await this.fetchGmail()
            : await this.fetchImap();

        for (const email of emails) {
            if (this.processedIds.has(email.id)) continue;

            // Apply filters
            if (!this.matchesFilters(email)) continue;

            this.processedIds.add(email.id);

            // Keep set size manageable
            if (this.processedIds.size > 10_000) {
                const arr = Array.from(this.processedIds);
                this.processedIds = new Set(arr.slice(-5_000));
            }

            log.info({ from: email.from, subject: email.subject }, 'New email matched');

            for (const handler of this.handlers) {
                try {
                    await handler(email);
                } catch (err: any) {
                    log.error({ err: err.message, emailId: email.id }, 'Email handler error');
                }
            }
        }

        this.lastChecked = new Date();
    }

    private matchesFilters(email: EmailMessage): boolean {
        if (!this.config.filters?.length) return true;

        return this.config.filters.some(filter => {
            if (filter.from) {
                const pattern = filter.from instanceof RegExp ? filter.from : new RegExp(filter.from, 'i');
                if (!pattern.test(email.from)) return false;
            }
            if (filter.subject) {
                const pattern = filter.subject instanceof RegExp ? filter.subject : new RegExp(filter.subject, 'i');
                if (!pattern.test(email.subject)) return false;
            }
            if (filter.hasAttachment && email.attachments.length === 0) return false;
            if (filter.label && !email.labels?.includes(filter.label)) return false;
            if (filter.after && email.date < filter.after) return false;
            return true;
        });
    }

    private async fetchGmail(): Promise<EmailMessage[]> {
        const creds = this.config.gmailCredentials;
        if (!creds) return [];

        try {
            // Refresh access token
            const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: creds.clientId,
                    client_secret: creds.clientSecret,
                    refresh_token: creds.refreshToken,
                    grant_type: 'refresh_token',
                }),
            });
            const tokens = await tokenRes.json() as any;
            const accessToken = tokens.access_token;

            // Fetch recent messages
            const query = `after:${Math.floor(this.lastChecked.getTime() / 1000)}`;
            const listRes = await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=20`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const listData = await listRes.json() as any;

            if (!listData.messages?.length) return [];

            const emails: EmailMessage[] = [];
            for (const msg of listData.messages.slice(0, 10)) {
                const msgRes = await fetch(
                    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                );
                const msgData = await msgRes.json() as any;
                const headers = msgData.payload?.headers || [];

                emails.push({
                    id: msg.id,
                    from: headers.find((h: any) => h.name === 'From')?.value || '',
                    to: (headers.find((h: any) => h.name === 'To')?.value || '').split(',').map((s: string) => s.trim()),
                    subject: headers.find((h: any) => h.name === 'Subject')?.value || '',
                    body: this.decodeGmailBody(msgData.payload),
                    date: new Date(parseInt(msgData.internalDate)),
                    attachments: this.extractGmailAttachments(msgData.payload),
                    labels: msgData.labelIds,
                    threadId: msgData.threadId,
                });
            }

            return emails;
        } catch (err: any) {
            log.error({ err: err.message }, 'Gmail fetch error');
            return [];
        }
    }

    private decodeGmailBody(payload: any): string {
        if (payload.body?.data) {
            return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
        }
        if (payload.parts) {
            const textPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
            if (textPart?.body?.data) {
                return Buffer.from(textPart.body.data, 'base64url').toString('utf-8');
            }
        }
        return '';
    }

    private extractGmailAttachments(payload: any): EmailAttachment[] {
        const attachments: EmailAttachment[] = [];
        if (payload.parts) {
            for (const part of payload.parts) {
                if (part.filename && part.body?.attachmentId) {
                    attachments.push({
                        filename: part.filename,
                        mimeType: part.mimeType,
                        size: part.body.size || 0,
                    });
                }
            }
        }
        return attachments;
    }

    private async fetchImap(): Promise<EmailMessage[]> {
        // IMAP implementation — supports Outlook, Yahoo, any IMAP server
        const imap = this.config.imap;
        if (!imap) return [];

        // Use net/tls sockets for IMAP (simplified)
        // In production, use a library like 'imapflow'
        log.debug({ host: imap.host }, 'IMAP fetch (stub — install imapflow for full support)');

        // Stub: would use dynamic import of 'imapflow' if available
        try {
            const { ImapFlow } = await import('imapflow' as string);
            const client = new ImapFlow({
                host: imap.host,
                port: imap.port,
                secure: imap.tls,
                auth: { user: imap.user, pass: imap.password },
                logger: false,
            });

            await client.connect();
            const lock = await client.getMailboxLock('INBOX');

            try {
                const messages: EmailMessage[] = [];
                const since = this.lastChecked.toISOString().split('T')[0];

                for await (const msg of client.fetch(
                    { since },
                    { envelope: true, bodyStructure: true, source: true }
                )) {
                    messages.push({
                        id: String(msg.uid),
                        from: msg.envelope?.from?.[0]?.address || '',
                        to: msg.envelope?.to?.map((t: any) => t.address) || [],
                        subject: msg.envelope?.subject || '',
                        body: msg.source?.toString() || '',
                        date: msg.envelope?.date ? new Date(msg.envelope.date) : new Date(),
                        attachments: [],
                    });
                }

                return messages;
            } finally {
                lock.release();
                await client.logout();
            }
        } catch {
            log.debug('imapflow not installed — IMAP support requires: npm install imapflow');
            return [];
        }
    }

    getStatus() {
        return {
            running: this.running,
            provider: this.config.provider,
            lastChecked: this.lastChecked,
            processedCount: this.processedIds.size,
            handlersCount: this.handlers.length,
        };
    }
}

// Hook system barrel
export interface Hook {
    name: string;
    type: 'email' | 'cron' | 'webhook' | 'filesystem';
    start(): Promise<void>;
    stop(): Promise<void>;
    getStatus(): Record<string, any>;
}
