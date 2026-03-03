/**
 * CoreBlow — Microsoft Teams Channel Adapter
 *
 * Production adapter for MS Teams via Bot Framework REST API.
 * Handles messages, adaptive cards, mentions, and conversations.
 * Uses raw HTTP — zero SDK dependency.
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('channel:teams');

const BOT_FRAMEWORK_AUTH_URL = 'https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token';
const BOT_FRAMEWORK_API = 'https://smba.trafficmanager.net/teams';

/** Teams bot configuration */
export interface TeamsConfig {
    appId: string;
    appPassword: string;
    tenantId?: string;
}

/** Teams activity (incoming message) */
export interface TeamsActivity {
    type: 'message' | 'conversationUpdate' | 'invoke' | 'event';
    id: string;
    timestamp: string;
    channelId: string;
    from: { id: string; name?: string; aadObjectId?: string };
    conversation: { id: string; tenantId?: string; isGroup?: boolean };
    recipient: { id: string; name?: string };
    text?: string;
    attachments?: Array<{ contentType: string; content: unknown }>;
    value?: unknown;
    serviceUrl: string;
}

/** Adaptive card action */
export interface AdaptiveCardAction {
    type: 'Action.Submit' | 'Action.OpenUrl' | 'Action.ShowCard';
    title: string;
    data?: unknown;
    url?: string;
}

/** Teams message handler */
export type TeamsMessageHandler = (activity: TeamsActivity) => Promise<string | void>;

/**
 * CoreBlow Teams Adapter
 *
 * Communicates with Bot Framework via REST API. Manages OAuth2
 * token lifecycle for service-to-service auth.
 */
export class TeamsAdapter {
    private config: TeamsConfig;
    private accessToken: string | null = null;
    private tokenExpiresAt = 0;
    private messageHandler: TeamsMessageHandler | null = null;
    private running = false;

    constructor(config: TeamsConfig) {
        this.config = config;
    }

    onMessage(handler: TeamsMessageHandler): void {
        this.messageHandler = handler;
    }

    /** Process an incoming activity (called from webhook endpoint) */
    async processActivity(activity: TeamsActivity): Promise<string | null> {
        if (!this.messageHandler) return null;
        if (activity.type !== 'message') return null;
        const response = await this.messageHandler(activity);
        if (response) {
            await this.replyToActivity(activity, response);
        }
        return response ?? null;
    }

    /** Send a message to a conversation */
    async sendMessage(serviceUrl: string, conversationId: string, text: string): Promise<string> {
        const token = await this.getToken();
        const url = `${serviceUrl}/v3/conversations/${conversationId}/activities`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'message',
                text,
                textFormat: 'markdown',
            }),
        });
        if (!res.ok) throw new Error(`Teams API error ${res.status}: ${await res.text()}`);
        const data = await res.json() as { id: string };
        return data.id;
    }

    /** Reply to a specific activity */
    async replyToActivity(activity: TeamsActivity, text: string): Promise<string> {
        const token = await this.getToken();
        const url = `${activity.serviceUrl}/v3/conversations/${activity.conversation.id}/activities/${activity.id}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'message',
                text,
                textFormat: 'markdown',
                replyToId: activity.id,
            }),
        });
        if (!res.ok) throw new Error(`Teams reply error ${res.status}`);
        const data = await res.json() as { id: string };
        return data.id;
    }

    /** Send an adaptive card */
    async sendAdaptiveCard(
        serviceUrl: string,
        conversationId: string,
        card: Record<string, unknown>,
    ): Promise<string> {
        const token = await this.getToken();
        const url = `${serviceUrl}/v3/conversations/${conversationId}/activities`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'message',
                attachments: [{
                    contentType: 'application/vnd.microsoft.card.adaptive',
                    content: { type: 'AdaptiveCard', version: '1.4', ...card },
                }],
            }),
        });
        if (!res.ok) throw new Error(`Teams card error ${res.status}`);
        const data = await res.json() as { id: string };
        return data.id;
    }

    /** Update an existing message */
    async updateActivity(
        serviceUrl: string,
        conversationId: string,
        activityId: string,
        text: string,
    ): Promise<void> {
        const token = await this.getToken();
        const url = `${serviceUrl}/v3/conversations/${conversationId}/activities/${activityId}`;
        const res = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ type: 'message', text }),
        });
        if (!res.ok) throw new Error(`Teams update error ${res.status}`);
    }

    /** Create a mention tag for a user */
    formatMention(userId: string, name: string): string {
        return `<at>${name}</at>`;
    }

    getStatus(): { running: boolean; appId: string } {
        return { running: this.running, appId: this.config.appId };
    }

    async start(): Promise<void> {
        await this.getToken(); // Validate credentials
        this.running = true;
        log.info({ appId: this.config.appId }, 'Teams adapter started');
    }

    async stop(): Promise<void> {
        this.running = false;
        this.accessToken = null;
        log.info('Teams adapter stopped');
    }

    // === Private ===

    private async getToken(): Promise<string> {
        if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) {
            return this.accessToken;
        }

        const res = await fetch(BOT_FRAMEWORK_AUTH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: this.config.appId,
                client_secret: this.config.appPassword,
                scope: 'https://api.botframework.com/.default',
            }),
        });

        if (!res.ok) throw new Error(`Teams auth error ${res.status}: ${await res.text()}`);
        const data = await res.json() as { access_token: string; expires_in: number };
        this.accessToken = data.access_token;
        this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
        return this.accessToken;
    }
}
