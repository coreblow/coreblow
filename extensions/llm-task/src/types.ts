/**
 * LlmTask Types
 */
export interface LlmTaskMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface LlmTaskUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface LlmTaskChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
