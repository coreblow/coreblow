import type { IncomingMessage, ServerResponse } from "node:http";
import {
  A2A_ERROR_CODES,
  type A2AAgentCard,
  type A2AJsonRpcResponse,
  type A2AMessage,
  type A2ATaskRecord,
} from "./protocol.js";

export class A2ATaskStore {
  private readonly tasks = new Map<string, A2ATaskRecord>();
  private readonly maxTasks: number;

  constructor(maxTasks = 1000) {
    this.maxTasks = Math.max(1, maxTasks);
  }

  public get(taskId: string): A2ATaskRecord | undefined {
    return this.tasks.get(taskId);
  }

  public upsert(record: A2ATaskRecord): A2ATaskRecord {
    if (!this.tasks.has(record.id) && this.tasks.size >= this.maxTasks) {
      const oldestKey = this.tasks.keys().next().value;
      if (oldestKey) {
        this.tasks.delete(oldestKey);
      }
    }
    this.tasks.set(record.id, record);
    return record;
  }

  public size(): number {
    return this.tasks.size;
  }
}

export type A2aRequestAuthorizer = (
  req: IncomingMessage,
) => Promise<{ ok: true } | { ok: false; statusCode?: number; reason: string }> | {
  ok: true;
} | { ok: false; statusCode?: number; reason: string };

export type A2aTaskSendHandler = (params: {
  readonly id: string;
  readonly sessionId?: string;
  readonly message: A2AMessage;
}) => Promise<{ readonly state?: "submitted" | "working" | "completed" | "failed"; readonly replyText?: string }> | {
  readonly state?: "submitted" | "working" | "completed" | "failed";
  readonly replyText?: string;
};

export interface CreateA2aHttpHandlerOptions {
  readonly agentCard: A2AAgentCard;
  readonly taskStore?: A2ATaskStore;
  readonly authorizeRequest?: A2aRequestAuthorizer;
  readonly onTaskSend?: A2aTaskSendHandler;
  readonly maxBodyBytes?: number;
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function rpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): A2AJsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: data === undefined ? { code, message } : { code, message, data },
  };
}

async function readJsonBody(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > maxBytes) {
      throw new Error("BODY_TOO_LARGE");
    }
    chunks.push(buf);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function validateTaskMessage(raw: unknown): A2AMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const msg = raw as Record<string, unknown>;
  if (msg.role !== "user" && msg.role !== "agent") return null;
  if (!Array.isArray(msg.parts) || msg.parts.length === 0) return null;
  for (const part of msg.parts) {
    if (!part || typeof part !== "object") return null;
    const p = part as Record<string, unknown>;
    if (p.type !== "text" || typeof p.text !== "string") return null;
  }
  return raw as A2AMessage;
}

export function createA2aHttpHandler(options: CreateA2aHttpHandlerOptions) {
  const taskStore = options.taskStore ?? new A2ATaskStore();
  const maxBodyBytes = options.maxBodyBytes ?? 256 * 1024;

  return async function handleA2aRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<boolean> {
    const url = new URL(req.url ?? "/", "http://localhost");
    const method = (req.method ?? "GET").toUpperCase();

    if (method === "GET" && url.pathname === "/.well-known/agent.json") {
      sendJson(res, 200, options.agentCard);
      return true;
    }

    if (method !== "POST" || (url.pathname !== "/a2a" && url.pathname !== "/")) {
      return false;
    }

    if (options.authorizeRequest) {
      const auth = await options.authorizeRequest(req);
      if (!auth.ok) {
        sendJson(
          res,
          auth.statusCode ?? 403,
          rpcError(null, A2A_ERROR_CODES.UNAUTHORIZED, auth.reason),
        );
        return true;
      }
    }

    let parsed: unknown;
    try {
      parsed = await readJsonBody(req, maxBodyBytes);
    } catch (err) {
      const msg = err instanceof Error && err.message === "BODY_TOO_LARGE"
        ? "Request body exceeds size limit"
        : "Parse error";
      sendJson(res, 400, rpcError(null, A2A_ERROR_CODES.PARSE_ERROR, msg));
      return true;
    }

    if (!parsed || typeof parsed !== "object") {
      sendJson(res, 400, rpcError(null, A2A_ERROR_CODES.INVALID_REQUEST, "Invalid JSON-RPC request"));
      return true;
    }

    const reqObj = parsed as Record<string, unknown>;
    const rpcId =
      typeof reqObj.id === "string" || typeof reqObj.id === "number" ? reqObj.id : null;
    if (reqObj.jsonrpc !== "2.0" || typeof reqObj.method !== "string" || rpcId === null) {
      sendJson(
        res,
        400,
        rpcError(rpcId, A2A_ERROR_CODES.INVALID_REQUEST, "Missing jsonrpc '2.0', id, or method"),
      );
      return true;
    }

    const params =
      reqObj.params && typeof reqObj.params === "object"
        ? (reqObj.params as Record<string, unknown>)
        : {};

    if (reqObj.method === "tasks/send") {
      const taskId = typeof params.id === "string" ? params.id.trim() : "";
      const message = validateTaskMessage(params.message);
      if (!taskId || !message) {
        sendJson(
          res,
          400,
          rpcError(rpcId, A2A_ERROR_CODES.INVALID_PARAMS, "tasks/send requires string id and valid message"),
        );
        return true;
      }

      const sessionId = typeof params.sessionId === "string" ? params.sessionId : undefined;
      const handlerOutcome = options.onTaskSend
        ? await options.onTaskSend({ id: taskId, sessionId, message })
        : { state: "completed" as const, replyText: "Accepted by CoreBlow A2A handler." };

      const history: A2AMessage[] = [message];
      let statusMessage: A2AMessage | undefined;
      if (handlerOutcome.replyText) {
        statusMessage = {
          role: "agent",
          parts: [{ type: "text", text: handlerOutcome.replyText }],
        };
        history.push(statusMessage);
      }

      const record: A2ATaskRecord = {
        id: taskId,
        ...(sessionId ? { sessionId } : {}),
        status: {
          state: handlerOutcome.state ?? "completed",
          timestamp: new Date().toISOString(),
          ...(statusMessage ? { message: statusMessage } : {}),
        },
        history,
      };
      taskStore.upsert(record);
      sendJson(res, 200, { jsonrpc: "2.0", id: rpcId, result: record });
      return true;
    }

    if (reqObj.method === "tasks/get") {
      const taskId = typeof params.id === "string" ? params.id.trim() : "";
      if (!taskId) {
        sendJson(
          res,
          400,
          rpcError(rpcId, A2A_ERROR_CODES.INVALID_PARAMS, "tasks/get requires string id"),
        );
        return true;
      }
      const record = taskStore.get(taskId);
      if (!record) {
        sendJson(
          res,
          404,
          rpcError(rpcId, A2A_ERROR_CODES.TASK_NOT_FOUND, `Task '${taskId}' not found`),
        );
        return true;
      }
      sendJson(res, 200, { jsonrpc: "2.0", id: rpcId, result: record });
      return true;
    }

    if (reqObj.method === "tasks/cancel") {
      const taskId = typeof params.id === "string" ? params.id.trim() : "";
      if (!taskId) {
        sendJson(
          res,
          400,
          rpcError(rpcId, A2A_ERROR_CODES.INVALID_PARAMS, "tasks/cancel requires string id"),
        );
        return true;
      }
      const existing = taskStore.get(taskId);
      if (!existing) {
        sendJson(
          res,
          404,
          rpcError(rpcId, A2A_ERROR_CODES.TASK_NOT_FOUND, `Task '${taskId}' not found`),
        );
        return true;
      }
      if (
        existing.status.state === "completed" ||
        existing.status.state === "canceled" ||
        existing.status.state === "failed"
      ) {
        sendJson(
          res,
          409,
          rpcError(
            rpcId,
            A2A_ERROR_CODES.TASK_NOT_CANCELABLE,
            `Task '${taskId}' in state '${existing.status.state}' cannot be canceled`,
          ),
        );
        return true;
      }
      const canceled: A2ATaskRecord = {
        ...existing,
        status: {
          state: "canceled",
          timestamp: new Date().toISOString(),
        },
      };
      taskStore.upsert(canceled);
      sendJson(res, 200, { jsonrpc: "2.0", id: rpcId, result: canceled });
      return true;
    }

    sendJson(
      res,
      404,
      rpcError(rpcId, A2A_ERROR_CODES.METHOD_NOT_FOUND, `Unknown A2A method '${reqObj.method}'`),
    );
    return true;
  };
}
