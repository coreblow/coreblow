/**
 * CoreBlow — WhatsApp Channel Adapter
 *
 * Production adapter for WhatsApp Business Cloud API.
 * Handles text, media, template messages, interactive buttons,
 * webhook verification, and delivery status tracking.
 */

/** WhatsApp configuration */
export interface WhatsAppConfig {
    phoneNumberId: string;
    accessToken: string;
    verifyToken: string;
    businessAccountId?: string;
    apiVersion?: string;
}

/** WhatsApp incoming message */
export interface WhatsAppMessage {
    messageId: string;
    from: string;
    timestamp: number;
    type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'reaction';
    text?: string;
    mediaId?: string;
    mediaUrl?: string;
    caption?: string;
    location?: { latitude: number; longitude: number };
}

/** Interactive button */
export interface WAButton {
    id: string;
    title: string;
}

/** Message handler */
export type WhatsAppMessageHandler = (msg: WhatsAppMessage) => Promise<string | void>;

/**
 * CoreBlow WhatsApp Adapter
 */
export class WhatsAppAdapter {
    private config: WhatsAppConfig;
    private baseUrl: string;
    private messageHandler: WhatsAppMessageHandler | null = null;
    private deliveryStatus = new Map<string, string>();

    constructor(config: WhatsAppConfig) {
        this.config = config;
        const ver = config.apiVersion ?? 'v21.0';
        this.baseUrl = `https://graph.facebook.com/${ver}/${config.phoneNumberId}`;
    }

    onMessage(handler: WhatsAppMessageHandler): void {
        this.messageHandler = handler;
    }

    /**
     * Send a text message.
     */
    async sendText(to: string, text: string): Promise<string> {
        const data = await this.api('/messages', {
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { preview_url: false, body: text },
        });
        return (data.messages as any[])?.[0]?.id ?? '';
    }

    /**
     * Send an image.
     */
    async sendImage(to: string, imageUrl: string, caption?: string): Promise<string> {
        const data = await this.api('/messages', {
            messaging_product: 'whatsapp',
            to,
            type: 'image',
            image: { link: imageUrl, caption },
        });
        return (data.messages as any[])?.[0]?.id ?? '';
    }

    /**
     * Send a document.
     */
    async sendDocument(to: string, docUrl: string, filename: string, caption?: string): Promise<string> {
        const data = await this.api('/messages', {
            messaging_product: 'whatsapp',
            to,
            type: 'document',
            document: { link: docUrl, filename, caption },
        });
        return (data.messages as any[])?.[0]?.id ?? '';
    }

    /**
     * Send interactive buttons.
     */
    async sendButtons(to: string, bodyText: string, buttons: WAButton[]): Promise<string> {
        const data = await this.api('/messages', {
            messaging_product: 'whatsapp',
            to,
            type: 'interactive',
            interactive: {
                type: 'button',
                body: { text: bodyText },
                action: {
                    buttons: buttons.map((b) => ({
                        type: 'reply',
                        reply: { id: b.id, title: b.title },
                    })),
                },
            },
        });
        return (data.messages as any[])?.[0]?.id ?? '';
    }

    /**
     * Send a template message.
     */
    async sendTemplate(to: string, templateName: string, languageCode: string = 'en'): Promise<string> {
        const data = await this.api('/messages', {
            messaging_product: 'whatsapp',
            to,
            type: 'template',
            template: { name: templateName, language: { code: languageCode } },
        });
        return (data.messages as any[])?.[0]?.id ?? '';
    }

    /**
     * Mark message as read.
     */
    async markRead(messageId: string): Promise<void> {
        await this.api('/messages', {
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId,
        });
    }

    /**
     * Verify webhook challenge (GET request).
     */
    verifyWebhook(mode: string, token: string, challenge: string): string | null {
        if (mode === 'subscribe' && token === this.config.verifyToken) {
            return challenge;
        }
        return null;
    }

    /**
     * Track delivery status.
     */
    updateDeliveryStatus(messageId: string, status: string): void {
        this.deliveryStatus.set(messageId, status);
    }

    getDeliveryStatus(messageId: string): string | undefined {
        return this.deliveryStatus.get(messageId);
    }

    // === Private ===

    private async api(endpoint: string, body: unknown): Promise<Record<string, unknown>> {
        const res = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.accessToken}`,
            },
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`WhatsApp API error ${res.status}: ${await res.text()}`);
        return await res.json() as Record<string, unknown>;
    }
}
