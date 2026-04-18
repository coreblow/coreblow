/** CoreBlow — Types: Telegram */ export interface TelegramConfig { token: string; allowedUsers?: number[]; webhookUrl?: string; parseMode?: "Markdown" | "HTML" | "MarkdownV2"; }
