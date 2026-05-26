import { resolveSessionAgentId } from "../../agents/agent-scope.js";
import type { CoreBlowConfig } from "../../config/config.js";

export type SessionHookContext = {
  sessionId: string;
  sessionKey: string;
  agentId: string;
};

export type SessionEndReason =
  | "new"
  | "reset"
  | "idle"
  | "daily"
  | "compaction"
  | "deleted"
  | "shutdown"
  | "restart"
  | "unknown";

function buildSessionHookContext(params: {
  sessionId: string;
  sessionKey: string;
  cfg: CoreBlowConfig;
}): SessionHookContext {
  return {
    sessionId: params.sessionId,
    sessionKey: params.sessionKey,
    agentId: resolveSessionAgentId({ sessionKey: params.sessionKey, config: params.cfg }),
  };
}

export function buildSessionStartHookPayload(params: {
  sessionId: string;
  sessionKey: string;
  cfg: CoreBlowConfig;
  resumedFrom?: string;
}): {
  event: { sessionId: string; sessionKey: string; resumedFrom?: string };
  context: SessionHookContext;
} {
  return {
    event: {
      sessionId: params.sessionId,
      sessionKey: params.sessionKey,
      resumedFrom: params.resumedFrom,
    },
    context: buildSessionHookContext({
      sessionId: params.sessionId,
      sessionKey: params.sessionKey,
      cfg: params.cfg,
    }),
  };
}

export function buildSessionEndHookPayload(params: {
  sessionId: string;
  sessionKey: string;
  cfg: CoreBlowConfig;
  messageCount?: number;
  reason?: SessionEndReason;
  sessionFile?: string;
  transcriptArchived?: boolean;
  nextSessionId?: string;
  nextSessionKey?: string;
}): {
  event: {
    sessionId: string;
    sessionKey: string;
    messageCount: number;
    reason?: string;
    sessionFile?: string;
    transcriptArchived?: boolean;
    nextSessionId?: string;
    nextSessionKey?: string;
  };
  context: SessionHookContext;
} {
  return {
    event: {
      sessionId: params.sessionId,
      sessionKey: params.sessionKey,
      messageCount: params.messageCount ?? 0,
      reason: params.reason,
      sessionFile: params.sessionFile,
      transcriptArchived: params.transcriptArchived,
      nextSessionId: params.nextSessionId,
      nextSessionKey: params.nextSessionKey,
    },
    context: buildSessionHookContext({
      sessionId: params.sessionId,
      sessionKey: params.sessionKey,
      cfg: params.cfg,
    }),
  };
}
