/**
 * VoiceCall Types
 */
export interface VoiceCallMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface VoiceCallUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface VoiceCallChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
