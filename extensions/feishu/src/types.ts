/**
 * Feishu Types
 */
export interface FeishuMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface FeishuUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface FeishuChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
