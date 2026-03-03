/**
 * QwenPortalAuth Types
 */
export interface QwenPortalAuthMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface QwenPortalAuthUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface QwenPortalAuthChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
