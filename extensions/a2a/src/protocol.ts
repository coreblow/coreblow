export type A2ATaskState =
  | "submitted"
  | "working"
  | "input-required"
  | "completed"
  | "canceled"
  | "failed";

export interface A2AAgentSkill {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly tags?: readonly string[];
}

export interface A2AAgentCapabilities {
  readonly streaming: boolean;
  readonly pushNotifications: boolean;
  readonly stateTransitionHistory: boolean;
}

export interface A2AAgentAuthentication {
  readonly schemes: readonly string[];
  readonly credentials?: string | null;
}

export interface A2AAgentCard {
  readonly name: string;
  readonly description?: string;
  readonly version: string;
  readonly url: string;
  readonly capabilities: A2AAgentCapabilities;
  readonly skills: readonly A2AAgentSkill[];
  readonly authentication: A2AAgentAuthentication;
}

export interface A2ATextPart {
  readonly type: "text";
  readonly text: string;
}

export interface A2AMessage {
  readonly role: "user" | "agent";
  readonly parts: readonly A2ATextPart[];
}

export interface A2ATaskStatus {
  readonly state: A2ATaskState;
  readonly timestamp: string;
  readonly message?: A2AMessage;
}

export interface A2ATaskRecord {
  readonly id: string;
  readonly sessionId?: string;
  readonly status: A2ATaskStatus;
  readonly history: readonly A2AMessage[];
  readonly artifacts?: readonly { readonly name?: string; readonly parts: readonly A2ATextPart[] }[];
}

export interface A2AJsonRpcRequest {
  readonly jsonrpc: "2.0";
  readonly id: string | number;
  readonly method: string;
  readonly params?: Record<string, unknown>;
}

export interface A2AJsonRpcError {
  readonly code: number;
  readonly message: string;
  readonly data?: unknown;
}

export interface A2AJsonRpcResponse<T = unknown> {
  readonly jsonrpc: "2.0";
  readonly id: string | number | null;
  readonly result?: T;
  readonly error?: A2AJsonRpcError;
}

export const A2A_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  TASK_NOT_FOUND: -32001,
  TASK_NOT_CANCELABLE: -32002,
  UNAUTHORIZED: -32003,
} as const;

export function buildAgentCard(params: {
  readonly name?: string;
  readonly description?: string;
  readonly version?: string;
  readonly url: string;
  readonly skills?: readonly A2AAgentSkill[];
  readonly schemes?: readonly string[];
}): A2AAgentCard {
  return {
    name: params.name?.trim() || "CoreBlow Agent",
    description: params.description ?? "Sovereign CoreBlow Agent-OS A2A endpoint",
    version: params.version?.trim() || "2.7.0",
    url: params.url,
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: true,
    },
    skills: params.skills ?? [
      {
        id: "coreflow-task",
        name: "CoreFlow Task Execution",
        description: "Executes bounded autonomous tasks via the CoreBlow Gateway.",
        tags: ["coreblow", "a2a"],
      },
    ],
    authentication: {
      schemes: params.schemes ?? ["bearer"],
    },
  };
}

export function validateAgentCard(raw: unknown): A2AAgentCard {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid A2A Agent Card: expected object");
  }
  const card = raw as Record<string, unknown>;
  for (const field of ["name", "version", "url"] as const) {
    if (typeof card[field] !== "string" || (card[field] as string).trim() === "") {
      throw new Error(`Invalid A2A Agent Card: missing or invalid '${field}'`);
    }
  }
  if (!card.capabilities || typeof card.capabilities !== "object") {
    throw new Error("Invalid A2A Agent Card: missing 'capabilities'");
  }
  if (!Array.isArray(card.skills)) {
    throw new Error("Invalid A2A Agent Card: 'skills' must be an array");
  }
  if (!card.authentication || typeof card.authentication !== "object") {
    throw new Error("Invalid A2A Agent Card: missing 'authentication'");
  }
  const auth = card.authentication as Record<string, unknown>;
  if (!Array.isArray(auth.schemes)) {
    throw new Error("Invalid A2A Agent Card: 'authentication.schemes' must be an array");
  }
  return raw as A2AAgentCard;
}
