/**
 * CoreBlow — LINE Channel Adapter
 *
 * Production adapter for LINE Messaging API. Handles text,
 * stickers, images, flex messages, and rich menus.
 * Uses raw HTTP — zero SDK dependency.
 */

import { createChildLogger } from '../utils/logger.js';
import { createHmac } from 'node:crypto';

const log = createChildLogger('channel:line');

const LINE_API = 'https://api.line.me/v2/bot';
const LINE_DATA_API = 'https://api-data.line.me/v2/bot';

/** LINE channel configuration */
export interface LINEConfig {
    channelAccessToken: string;
    channelSecret: string;
}

/** LINE webhook event */
export interface LINEEvent {
    type: 'message' | 'follow' | 'unfollow' | 'join' | 'leave' | 'postback';
    replyToken?: string;
    source: { type: 'user' | 'group' | 'room'; userId?: string; groupId?: string; roomId?: string };
    timestamp: number;
    message?: {
        id: string;
        type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'sticker';
        text?: string;
        packageId?: string;
        stickerId?: string;
    };
    postback?: { data: string };
}

/** LINE flex message container */
export interface FlexContainer {
    type: 'bubble' | 'carousel';
    [key: string]: unknown;
}

/** LINE message handler */
export type LINEMessageHandler = (event: LINEEvent) => Promise<string | void>;

/**
 * CoreBlow LINE Adapter
 */
export class LINEAdapter {
    private config: LINEConfig;
    private messageHandler: LINEMessageHandler | null = null;
    private running = false;

    constructor(config: LINEConfig) {
        this.config = config;
    }

    onMessage(handler: LINEMessageHandler): void {
        this.messageHandler = handler;
    }

    /** Verify webhook signature */
    verifySignature(body: string, signature: string): boolean {
        const hash = createHmac('SHA256', this.config.channelSecret)
            .update(body)
            .digest('base64');
        return hash === signature;
    }

    /** Process webhook events */
    async processWebhookEvents(events: LINEEvent[]): Promise<void> {
        for (const event of events) {
            if (event.type === 'message' && event.message?.type === 'text' && this.messageHandler) {
                const reply = await this.messageHandler(event);
                if (reply && event.replyToken) {
                    await this.replyText(event.replyToken, reply);
                }
            }
        }
    }

    /** Reply with text using a reply token */
    async replyText(replyToken: string, text: string): Promise<void> {
        await this.api('/message/reply', {
            replyToken,
            messages: [{ type: 'text', text }],
        });
    }

    /** Reply with multiple messages */
    async replyMessages(replyToken: string, messages: Array<Record<string, unknown>>): Promise<void> {
        await this.api('/message/reply', { replyToken, messages });
    }

    /** Push a message to a user/group */
    async pushMessage(to: string, text: string): Promise<void> {
        await this.api('/message/push', {
            to,
            messages: [{ type: 'text', text }],
        });
    }

    /** Push an image */
    async pushImage(to: string, originalUrl: string, previewUrl?: string): Promise<void> {
        await this.api('/message/push', {
            to,
            messages: [{
                type: 'image',
                originalContentUrl: originalUrl,
                previewImageUrl: previewUrl ?? originalUrl,
            }],
        });
    }

    /** Push a flex message */
    async pushFlexMessage(to: string, altText: string, contents: FlexContainer): Promise<void> {
        await this.api('/message/push', {
            to,
            messages: [{ type: 'flex', altText, contents }],
        });
    }

    /** Get user profile */
    async getUserProfile(userId: string): Promise<{
        displayName: string;
        userId: string;
        pictureUrl?: string;
        statusMessage?: string;
    }> {
        const res = await fetch(`${LINE_API}/profile/${userId}`, {
            headers: { 'Authorization': `Bearer ${this.config.channelAccessToken}` },
        });
        if (!res.ok) throw new Error(`LINE profile error ${res.status}`);
        return await res.json() as any;
    }

    /** Get message content (image/video/audio binary) */
    async getMessageContent(messageId: string): Promise<ArrayBuffer> {
        const res = await fetch(`${LINE_DATA_API}/message/${messageId}/content`, {
            headers: { 'Authorization': `Bearer ${this.config.channelAccessToken}` },
        });
        if (!res.ok) throw new Error(`LINE content error ${res.status}`);
        return await res.arrayBuffer();
    }

    /** Set rich menu for a user */
    async setRichMenu(userId: string, richMenuId: string): Promise<void> {
        const res = await fetch(`${LINE_API}/user/${userId}/richmenu/${richMenuId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.config.channelAccessToken}` },
        });
        if (!res.ok) throw new Error(`LINE richmenu error ${res.status}`);
    }

    getStatus(): { running: boolean } {
        return { running: this.running };
    }

    async start(): Promise<void> {
        this.running = true;
        log.info('LINE adapter started');
    }

    async stop(): Promise<void> {
        this.running = false;
        log.info('LINE adapter stopped');
    }

    // === Private ===

    private async api(path: string, body: unknown): Promise<Record<string, unknown>> {
        const res = await fetch(`${LINE_API}${path}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.channelAccessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`LINE API error ${res.status}: ${await res.text()}`);
        const text = await res.text();
        return text ? JSON.parse(text) : {};
    }
}
