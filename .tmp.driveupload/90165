/**
 * hooks/internal-hooks.ts — Core event type system and global hook registry.
 *
 * Mirrors CoreBlow's internal-hooks.ts: type-safe event definitions,
 * globalThis-backed handler registry, register/unregister/trigger lifecycle.
 */

// ─── Event Types ────────────────────────────────────────────────────

export type InternalHookEventType = "command" | "session" | "agent" | "gateway" | "message";

export interface InternalHookEvent {
  /** The type of event (command, session, agent, gateway, message) */
  type: InternalHookEventType;
  /** The specific action within the type (e.g., 'new', 'reset', 'stop') */
  action: string;
  /** The session key this event relates to */
  sessionKey: string;
  /** Additional context specific to the event */
  context: Record<string, unknown>;
  /** Timestamp when the event occurred */
  timestamp: Date;
  /** Messages to send back to the user (hooks can push to this array) */
  messages: string[];
}

export type InternalHookHandler = (event: InternalHookEvent) => Promise<void> | void;

// ─── Typed Event Contexts ───────────────────────────────────────────

export type AgentBootstrapHookContext = {
  workspaceDir: string;
  bootstrapFiles: Array<{ path: string; content: string }>;
  sessionKey?: string;
  sessionId?: string;
  agentId?: string;
};

export type AgentBootstrapHookEvent = InternalHookEvent & {
  type: "agent";
  action: "bootstrap";
  context: AgentBootstrapHookContext;
};

export type GatewayStartupHookContext = {
  workspaceDir?: string;
};

export type GatewayStartupHookEvent = InternalHookEvent & {
  type: "gateway";
  action: "startup";
  context: GatewayStartupHookContext;
};

export type MessageReceivedHookContext = {
  from: string;
  content: string;
  timestamp?: number;
  channelId: string;
  accountId?: string;
  conversationId?: string;
  messageId?: string;
  metadata?: Record<string, unknown>;
};

export type MessageReceivedHookEvent = InternalHookEvent & {
  type: "message";
  action: "received";
  context: MessageReceivedHookContext;
};

export type MessageSentHookContext = {
  to: string;
  content: string;
  success: boolean;
  error?: string;
  channelId: string;
  accountId?: string;
  conversationId?: string;
  messageId?: string;
  isGroup?: boolean;
  groupId?: string;
};

export type MessageSentHookEvent = InternalHookEvent & {
  type: "message";
  action: "sent";
  context: MessageSentHookContext;
};

export type MessageTranscribedHookContext = {
  transcript: string;
  channelId: string;
  from?: string;
  body?: string;
  bodyForAgent?: string;
  conversationId?: string;
  messageId?: string;
  mediaPath?: string;
  mediaType?: string;
};

export type MessageTranscribedHookEvent = InternalHookEvent & {
  type: "message";
  action: "transcribed";
  context: MessageTranscribedHookContext;
};

export type SessionPatchHookContext = {
  sessionEntry: Record<string, unknown>;
  patch: Record<string, unknown>;
};

export type SessionPatchHookEvent = InternalHookEvent & {
  type: "session";
  action: "patch";
  context: SessionPatchHookContext;
};

// ─── Global Handler Registry ────────────────────────────────────────

const INTERNAL_HOOK_HANDLERS_KEY = Symbol.for("coreblow.internalHookHandlers");

function getHandlers(): Map<string, InternalHookHandler[]> {
  const g = globalThis as Record<symbol, unknown>;
  if (!g[INTERNAL_HOOK_HANDLERS_KEY]) {
    g[INTERNAL_HOOK_HANDLERS_KEY] = new Map<string, InternalHookHandler[]>();
  }
  return g[INTERNAL_HOOK_HANDLERS_KEY] as Map<string, InternalHookHandler[]>;
}

/**
 * Register a hook handler for a specific event type or event:action combination.
 *
 * @example
 * ```ts
 * registerInternalHook('command', async (event) => { console.log(event.action); });
 * registerInternalHook('command:new', async (event) => { await saveSession(event); });
 * ```
 */
export function registerInternalHook(eventKey: string, handler: InternalHookHandler): void {
  const handlers = getHandlers();
  if (!handlers.has(eventKey)) {
    handlers.set(eventKey, []);
  }
  handlers.get(eventKey)!.push(handler);
}

/**
 * Unregister a specific hook handler.
 */
export function unregisterInternalHook(eventKey: string, handler: InternalHookHandler): void {
  const handlers = getHandlers();
  const eventHandlers = handlers.get(eventKey);
  if (!eventHandlers) return;

  const index = eventHandlers.indexOf(handler);
  if (index !== -1) {
    eventHandlers.splice(index, 1);
  }
  if (eventHandlers.length === 0) {
    handlers.delete(eventKey);
  }
}

/**
 * Clear all registered hooks (useful for testing).
 */
export function clearInternalHooks(): void {
  getHandlers().clear();
}

/**
 * Get all registered event keys (useful for debugging).
 */
export function getRegisteredEventKeys(): string[] {
  return Array.from(getHandlers().keys());
}

/**
 * Check if any listeners exist for the given type:action pair.
 */
export function hasInternalHookListeners(type: InternalHookEventType, action: string): boolean {
  const handlers = getHandlers();
  return (
    (handlers.get(type)?.length ?? 0) > 0 ||
    (handlers.get(`${type}:${action}`)?.length ?? 0) > 0
  );
}

/**
 * Trigger a hook event. Calls handlers for:
 *   1. The general event type (e.g., 'command')
 *   2. The specific event:action (e.g., 'command:new')
 *
 * Errors are caught and logged but don't prevent other handlers from running.
 */
export async function triggerInternalHook(event: InternalHookEvent): Promise<void> {
  if (!hasInternalHookListeners(event.type, event.action)) {
    return;
  }

  const handlers = getHandlers();
  const typeHandlers = handlers.get(event.type) ?? [];
  const specificHandlers = handlers.get(`${event.type}:${event.action}`) ?? [];
  const allHandlers = [...typeHandlers, ...specificHandlers];

  for (const handler of allHandlers) {
    try {
      await handler(event);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[internal-hooks] Hook error [${event.type}:${event.action}]: ${message}`);
    }
  }
}

/**
 * Create a hook event with common fields filled in.
 */
export function createInternalHookEvent(
  type: InternalHookEventType,
  action: string,
  sessionKey: string,
  context: Record<string, unknown> = {},
): InternalHookEvent {
  return {
    type,
    action,
    sessionKey,
    context,
    timestamp: new Date(),
    messages: [],
  };
}

// ─── Type Guards ────────────────────────────────────────────────────

function isTypeAction(event: InternalHookEvent, type: InternalHookEventType, action: string): boolean {
  return event.type === type && event.action === action;
}

function hasCtx<T extends Record<string, unknown>>(event: InternalHookEvent): Partial<T> | null {
  const context = event.context as Partial<T> | null;
  return context && typeof context === "object" ? context : null;
}

function hasStr<T extends Record<string, unknown>>(ctx: Partial<T>, key: keyof T): boolean {
  return typeof ctx[key] === "string";
}

function hasBool<T extends Record<string, unknown>>(ctx: Partial<T>, key: keyof T): boolean {
  return typeof ctx[key] === "boolean";
}

export function isAgentBootstrapEvent(event: InternalHookEvent): event is AgentBootstrapHookEvent {
  if (!isTypeAction(event, "agent", "bootstrap")) return false;
  const ctx = hasCtx<AgentBootstrapHookContext>(event);
  if (!ctx) return false;
  return hasStr(ctx, "workspaceDir") && Array.isArray(ctx.bootstrapFiles);
}

export function isGatewayStartupEvent(event: InternalHookEvent): event is GatewayStartupHookEvent {
  if (!isTypeAction(event, "gateway", "startup")) return false;
  return Boolean(hasCtx<GatewayStartupHookContext>(event));
}

export function isMessageReceivedEvent(event: InternalHookEvent): event is MessageReceivedHookEvent {
  if (!isTypeAction(event, "message", "received")) return false;
  const ctx = hasCtx<MessageReceivedHookContext>(event);
  if (!ctx) return false;
  return hasStr(ctx, "from") && hasStr(ctx, "channelId");
}

export function isMessageSentEvent(event: InternalHookEvent): event is MessageSentHookEvent {
  if (!isTypeAction(event, "message", "sent")) return false;
  const ctx = hasCtx<MessageSentHookContext>(event);
  if (!ctx) return false;
  return hasStr(ctx, "to") && hasStr(ctx, "channelId") && hasBool(ctx, "success");
}

export function isMessageTranscribedEvent(event: InternalHookEvent): event is MessageTranscribedHookEvent {
  if (!isTypeAction(event, "message", "transcribed")) return false;
  const ctx = hasCtx<MessageTranscribedHookContext>(event);
  if (!ctx) return false;
  return hasStr(ctx, "transcript") && hasStr(ctx, "channelId");
}

export function isSessionPatchEvent(event: InternalHookEvent): event is SessionPatchHookEvent {
  if (!isTypeAction(event, "session", "patch")) return false;
  const ctx = hasCtx<SessionPatchHookContext>(event);
  if (!ctx) return false;
  return typeof ctx.patch === "object" && ctx.patch !== null && typeof ctx.sessionEntry === "object" && ctx.sessionEntry !== null;
}
