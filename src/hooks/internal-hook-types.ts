export type InternalHookEventType = "command" | "session" | "agent" | "gateway" | "message";

export interface InternalHookEvent {
  type: InternalHookEventType;
  action: string;
  sessionKey: string;
  context: Record<string, unknown>;
  timestamp: Date;
  messages: string[];
}

export type InternalHookHandler = (event: InternalHookEvent) => Promise<void> | void;
