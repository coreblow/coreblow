/**
 * PhoneControl Types
 */
export interface PhoneControlMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface PhoneControlUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface PhoneControlChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
