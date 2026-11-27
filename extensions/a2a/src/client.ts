import {
  validateAgentCard,
  type A2AAgentCard,
  type A2AJsonRpcResponse,
  type A2AMessage,
  type A2ATaskRecord,
} from "./protocol.js";
import {
  assertA2aPolicyAllowed,
  assertSafeA2aUrl,
  redactA2aOutboundText,
  type AgentToAgentPolicyConfig,
} from "./security.js";

export interface A2AClientOptions {
  readonly policy?: AgentToAgentPolicyConfig;
  readonly timeoutMs?: number;
  readonly allowPrivateNetworkForTest?: boolean;
  readonly authToken?: string;
}

export class A2AClient {
  private readonly policy?: AgentToAgentPolicyConfig;
  private readonly timeoutMs: number;
  private readonly allowPrivateNetworkForTest: boolean;
  private readonly authToken?: string;

  constructor(options: A2AClientOptions = {}) {
    this.policy = options.policy;
    this.timeoutMs = Math.max(100, options.timeoutMs ?? 15_000);
    this.allowPrivateNetworkForTest = options.allowPrivateNetworkForTest === true;
    this.authToken = options.authToken;
  }

  public async discoverAgentCard(baseUrl: string, targetAgentId = "*"): Promise<A2AAgentCard> {
    assertA2aPolicyAllowed(this.policy, targetAgentId);
    const safeBase = assertSafeA2aUrl(baseUrl, {
      allowPrivateNetworkForTest: this.allowPrivateNetworkForTest,
    });
    const discoveryUrl = new URL("/.well-known/agent.json", safeBase);
    const res = await fetch(discoveryUrl, {
      method: "GET",
      headers: this.buildHeaders(),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`A2A discovery failed with HTTP ${res.status}`);
    }
    const payload = await res.json();
    return validateAgentCard(payload);
  }

  public async sendTask(params: {
    readonly endpointUrl: string;
    readonly targetAgentId: string;
    readonly taskId: string;
    readonly message: A2AMessage;
    readonly sessionId?: string;
  }): Promise<A2ATaskRecord> {
    assertA2aPolicyAllowed(this.policy, params.targetAgentId);
    const sanitizedMessage: A2AMessage = {
      role: params.message.role,
      parts: params.message.parts.map((part) => ({
        type: "text",
        text: redactA2aOutboundText(part.text),
      })),
    };
    return this.callRpc<A2ATaskRecord>(params.endpointUrl, "tasks/send", {
      id: params.taskId,
      ...(params.sessionId ? { sessionId: params.sessionId } : {}),
      message: sanitizedMessage,
    });
  }

  public async getTask(params: {
    readonly endpointUrl: string;
    readonly targetAgentId: string;
    readonly taskId: string;
  }): Promise<A2ATaskRecord> {
    assertA2aPolicyAllowed(this.policy, params.targetAgentId);
    return this.callRpc<A2ATaskRecord>(params.endpointUrl, "tasks/get", { id: params.taskId });
  }

  public async cancelTask(params: {
    readonly endpointUrl: string;
    readonly targetAgentId: string;
    readonly taskId: string;
  }): Promise<A2ATaskRecord> {
    assertA2aPolicyAllowed(this.policy, params.targetAgentId);
    return this.callRpc<A2ATaskRecord>(params.endpointUrl, "tasks/cancel", { id: params.taskId });
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }
    return headers;
  }

  private async callRpc<T>(
    endpointUrl: string,
    method: string,
    params: Record<string, unknown>,
  ): Promise<T> {
    const safeUrl = assertSafeA2aUrl(endpointUrl, {
      allowPrivateNetworkForTest: this.allowPrivateNetworkForTest,
    });
    const res = await fetch(safeUrl, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `${method}-${Date.now()}`,
        method,
        params,
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    const json = (await res.json()) as A2AJsonRpcResponse<T>;
    if (json.error) {
      throw new Error(`A2A RPC error ${json.error.code}: ${json.error.message}`);
    }
    if (!res.ok || json.result === undefined) {
      throw new Error(`A2A RPC failed with HTTP ${res.status}`);
    }
    return json.result;
  }
}
