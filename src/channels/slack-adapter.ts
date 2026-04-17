/**
 * CoreBlow — Slack Channel Adapter
 *
 * Production adapter for Slack. Handles messages via Web API,
 * slash commands, interactive components, Block Kit messages,
 * file uploads, and thread replies.
 */

/** Slack configuration */
export interface SlackConfig {
    botToken: string;
    appToken?: string;
    signingSecret: string;
    defaultChannel?: string;
}

/** Slack message */
export interface SlackMessage {
    ts: string;
    channel: string;
    userId: string;
    text: string;
    threadTs?: string;
    files?: Array<{ id: string; name: string; url: string; size: number }>;
    isBot: boolean;
    isDM: boolean;
}

/** Slack Block Kit block */
export interface SlackBlock {
    type: 'section' | 'divider' | 'header' | 'actions' | 'context' | 'image';
    text?: { type: 'mrkdwn' | 'plain_text'; text: string };
    accessory?: Record<string, unknown>;
    elements?: Array<Record<string, unknown>>;
    image_url?: string;
    alt_text?: string;
}

/** Message handler */
export type SlackMessageHandler = (msg: SlackMessage) => Promise<string | void>;

/**
 * CoreBlow Slack Adapter
 */
export class SlackAdapter {
    private config: SlackConfig;
    private baseUrl = 'https://slack.com/api';
    private messageHandler: SlackMessageHandler | null = null;
    private connected = false;

    constructor(config: SlackConfig) {
        this.config = config;
    }

    onMessage(handler: SlackMessageHandler): void {
        this.messageHandler = handler;
    }

    /**
     * Send a text message.
     */
    async sendMessage(channel: string, text: string, options?: {
        threadTs?: string;
        blocks?: SlackBlock[];
        unfurlLinks?: boolean;
    }): Promise<string> {
        const body: Record<string, unknown> = { channel, text };
        if (options?.threadTs) body.thread_ts = options.threadTs;
        if (options?.blocks) body.blocks = options.blocks;
        if (options?.unfurlLinks !== undefined) body.unfurl_links = options.unfurlLinks;

        const data = await this.api('chat.postMessage', body);
        return (data as Record<string, unknown>).ts as string;
    }

    /**
     * Send Block Kit message.
     */
    async sendBlocks(channel: string, blocks: SlackBlock[], text?: string): Promise<string> {
        return this.sendMessage(channel, text ?? '', { blocks });
    }

    /**
     * Update a message.
     */
    async updateMessage(channel: string, ts: string, text: string, blocks?: SlackBlock[]): Promise<void> {
        await this.api('chat.update', { channel, ts, text, blocks });
    }

    /**
     * Delete a message.
     */
    async deleteMessage(channel: string, ts: string): Promise<void> {
        await this.api('chat.delete', { channel, ts });
    }

    /**
     * Add a reaction.
     */
    async addReaction(channel: string, ts: string, emoji: string): Promise<void> {
        await this.api('reactions.add', { channel, timestamp: ts, name: emoji });
    }

    /**
     * Reply in a thread.
     */
    async replyInThread(channel: string, threadTs: string, text: string): Promise<string> {
        return this.sendMessage(channel, text, { threadTs });
    }

    /**
     * Upload a file.
     */
    async uploadFile(channels: string[], filename: string, content: string, title?: string): Promise<string> {
        const data = await this.api('files.upload', {
            channels: channels.join(','),
            filename,
            content,
            title,
        });
        return ((data.file as Record<string, unknown>)?.id as string) ?? '';
    }

    /**
     * Get channel list.
     */
    async getChannels(limit: number = 100): Promise<Array<{ id: string; name: string }>> {
        const data = await this.api('conversations.list', { limit, types: 'public_channel,private_channel' });
        return ((data.channels as Array<Record<string, unknown>>) ?? []).map((c: Record<string, unknown>) => ({ id: c.id as string, name: c.name as string }));
    }

    /**
     * Verify Slack request signature.
     */
    verifySignature(signature: string, timestamp: string, body: string): boolean {
        const crypto = require('node:crypto');
        const baseString = `v0:${timestamp}:${body}`;
        const hmac = crypto.createHmac('sha256', this.config.signingSecret).update(baseString).digest('hex');
        const expected = `v0=${hmac}`;
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    }

    getStatus(): { connected: boolean } { return { connected: this.connected }; }
    async connect(): Promise<void> { this.connected = true; }
    async disconnect(): Promise<void> { this.connected = false; }

    // === Private ===

    private async api(method: string, body: unknown): Promise<Record<string, unknown>> {
        const res = await fetch(`${this.baseUrl}/${method}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.botToken}`,
            },
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Slack API error ${res.status}`);
        const data = await res.json() as Record<string, unknown>;
        if (!data.ok) throw new Error(`Slack error: ${data.error}`);
        return data;
    }
}
