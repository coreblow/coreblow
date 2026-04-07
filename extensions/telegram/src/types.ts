/**
 * Telegram Types
 */
export interface TelegramMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface TelegramUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface TelegramChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
