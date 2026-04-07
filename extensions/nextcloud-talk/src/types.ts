/**
 * NextcloudTalk Types
 */
export interface NextcloudTalkMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface NextcloudTalkUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface NextcloudTalkChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
