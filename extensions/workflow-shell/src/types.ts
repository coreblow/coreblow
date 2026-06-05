/**
 * WorkflowShell Types
 */
export interface WorkflowShellMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface WorkflowShellUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface WorkflowShellChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
