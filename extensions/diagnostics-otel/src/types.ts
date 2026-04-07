/**
 * DiagnosticsOtel Types
 */
export interface DiagnosticsOtelMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface DiagnosticsOtelUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface DiagnosticsOtelChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
