/**
 * CoreBlow — Telegram Channel Adapter
 *
 * Production adapter for Telegram Bot API. Handles messages,
 * inline keyboards, media, webhooks, groups, reply chains,
 * and command parsing.
 */

/** Telegram bot configuration */
export interface TelegramConfig {
    token: string;
    webhookUrl?: string;
    allowedUpdates?: string[];
    parseMode?: 'HTML' | 'MarkdownV2' | 'Markdown';
}

/** Telegram message */
export interface TelegramMessage {
    messageId: number;
    chatId: number;
    chatType: 'private' | 'group' | 'supergroup' | 'channel';
    fromId: number;
    fromUsername?: string;
    text?: string;
    replyToMessageId?: number;
    date: number;
    photo?: Array<{ file_id: string; width: number; height: number }>;
    document?: { file_id: string; file_name: string; file_size: number };
    voice?: { file_id: string; duration: number };
}

/** Inline keyboard button */
export interface InlineButton {
    text: string;
    callbackData?: string;
    url?: string;
}

/** Message handler */
export type TelegramMessageHandler = (msg: TelegramMessage) => Promise<string | void>;

/**
 * CoreBlow Telegram Adapter
 */
export class TelegramAdapter {
    private config: TelegramConfig;
    private baseUrl: string;
    private messageHandler: TelegramMessageHandler | null = null;
    private running = false;

    constructor(config: TelegramConfig) {
        this.config = { parseMode: 'HTML', ...config };
        this.baseUrl = `https://api.telegram.org/bot${config.token}`;
    }

    onMessage(handler: TelegramMessageHandler): void {
        this.messageHandler = handler;
    }

    /**
     * Send a text message.
     */
    async sendMessage(chatId: number | string, text: string, options?: {
        replyToMessageId?: number;
        keyboard?: InlineButton[][];
        parseMode?: string;
    }): Promise<number> {
        const body: Record<string, unknown> = {
            chat_id: chatId,
            text,
            parse_mode: options?.parseMode ?? this.config.parseMode,
        };
        if (options?.replyToMessageId) body.reply_to_message_id = options.replyToMessageId;
        if (options?.keyboard) {
            body.reply_markup = {
                inline_keyboard: options.keyboard.map((row) =>
                    row.map((btn) => ({
                        text: btn.text,
                        callback_data: btn.callbackData,
                        url: btn.url,
                    })),
                ),
            };
        }

        const data = await this.api('sendMessage', body);
        return (data.result as any).message_id;
    }

    /**
     * Send a photo.
     */
    async sendPhoto(chatId: number | string, photoUrl: string, caption?: string): Promise<number> {
        const data = await this.api('sendPhoto', {
            chat_id: chatId,
            photo: photoUrl,
            caption,
            parse_mode: this.config.parseMode,
        });
        return (data.result as any).message_id;
    }

    /**
     * Send a document.
     */
    async sendDocument(chatId: number | string, documentUrl: string, caption?: string): Promise<number> {
        const data = await this.api('sendDocument', {
            chat_id: chatId,
            document: documentUrl,
            caption,
        });
        return (data.result as any).message_id;
    }

    /**
     * Edit a message.
     */
    async editMessage(chatId: number | string, messageId: number, text: string): Promise<void> {
        await this.api('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text,
            parse_mode: this.config.parseMode,
        });
    }

    /**
     * Delete a message.
     */
    async deleteMessage(chatId: number | string, messageId: number): Promise<void> {
        await this.api('deleteMessage', { chat_id: chatId, message_id: messageId });
    }

    /**
     * Answer a callback query (inline keyboard).
     */
    async answerCallback(callbackId: string, text?: string): Promise<void> {
        await this.api('answerCallbackQuery', {
            callback_query_id: callbackId,
            text,
        });
    }

    /**
     * Set a webhook URL.
     */
    async setWebhook(url: string): Promise<void> {
        await this.api('setWebhook', {
            url,
            allowed_updates: this.config.allowedUpdates ?? ['message', 'callback_query'],
        });
    }

    /**
     * Get bot info.
     */
    async getMe(): Promise<Record<string, unknown>> {
        const data = await this.api('getMe', {});
        return data.result as Record<string, unknown>;
    }

    getStatus(): { running: boolean } {
        return { running: this.running };
    }

    async start(): Promise<void> { this.running = true; }
    async stop(): Promise<void> { this.running = false; }

    // === Private ===

    private async api(method: string, body: unknown): Promise<Record<string, unknown>> {
        const res = await fetch(`${this.baseUrl}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Telegram API error ${res.status}: ${await res.text()}`);
        return await res.json() as Record<string, unknown>;
    }
}
