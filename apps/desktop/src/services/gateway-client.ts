import type {
  AgentScreenFrame,
  ChatMessage,
  ChatThread,
  CoryMemoryItem,
  CoryMemoryLayer,
  CoryProfilePayload,
  CoreHubSkill,
  CredentialPoolPayload,
  DialecticTrait,
  MaskedPooledCredential,
  MemoryProposal,
  ModelTier,
  PermissionMode,
  RemoteNodeConfig,
  ToolExecutionStep,
  VoiceSpeakResponse,
  VoiceTranscribeResponse,
  WarRoomChatMessage,
  WarRoomState,
} from "../types/gateway";

export const GATEWAY_BASE_URL = "http://127.0.0.1:18789";

export interface StreamCallbacks {
  onDelta?: (delta: string) => void;
  onStep?: (step: ToolExecutionStep) => void;
  onToolStep?: (toolStep: ToolExecutionStep) => void;
  onDone?: (fullReply: string) => void;
  onError?: (err: Error) => void;
}

export interface StreamChatCredentials {
  anthropicApiKey?: string;
  openAiApiKey?: string;
  geminiApiKey?: string;
  groqApiKey?: string;
  localOllamaUrl?: string;
  customApiKey?: string;
}

/**
 * Parses string representations of progress steps emitted by the microkernel.
 * Examples:
 * - "Executing list_dir (coreblow)"
 * - "✓ list_dir · coreblow (12ms)"
 * - "✗ terminal · rm -rf / (5ms)"
 */
export function parseStepString(str: string): {
  tool: string;
  description?: string;
  status: "running" | "done" | "error";
  durationMs?: number;
} {
  const trimmed = str.trim();

  if (trimmed.startsWith("Executing ")) {
    const rest = trimmed.slice(10).trim();
    const match = rest.match(/^([a-zA-Z0-9_-]+)(?:\s*\((.*?)\))?/);
    if (match) {
      return {
        tool: match[1],
        description: match[2] ? match[2].trim() : undefined,
        status: "running",
      };
    }
    const parts = rest.split(" ");
    return {
      tool: parts[0] || "tool",
      description: parts.slice(1).join(" ") || undefined,
      status: "running",
    };
  }

  if (trimmed.startsWith("✓") || trimmed.startsWith("✗")) {
    const isSuccess = trimmed.startsWith("✓");
    const rest = trimmed.slice(1).trim();

    let durationMs: number | undefined;
    let withoutDuration = rest;
    const durMatch = rest.match(/\((\d+)ms\)$/);
    if (durMatch) {
      durationMs = Number.parseInt(durMatch[1], 10);
      withoutDuration = rest.slice(0, durMatch.index).trim();
    }

    const dotParts = withoutDuration.split("·");
    const tool = dotParts[0].trim();
    const description = dotParts[1] ? dotParts[1].trim() : undefined;

    return {
      tool: tool || "tool",
      description,
      status: isSuccess ? "done" : "error",
      durationMs,
    };
  }

  return {
    tool: "Execution",
    description: trimmed,
    status: "running",
  };
}

export class CoreBlowGatewayClient {
  private baseUrl: string;
  private bearerToken?: string;

  constructor(baseUrl: string = GATEWAY_BASE_URL, bearerToken?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.bearerToken = bearerToken?.trim() || undefined;
  }

  /**
   * Set the active gateway target node (URL and optional Bearer token).
   */
  setTargetNode(baseUrl: string, bearerToken?: string): void {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.bearerToken = bearerToken?.trim() || undefined;
  }

  /**
   * Get the active gateway target node configuration.
   */
  getTargetNode(): { baseUrl: string; bearerToken?: string } {
    return { baseUrl: this.baseUrl, bearerToken: this.bearerToken };
  }

  /**
   * Attaches Authorization: Bearer <token> if a bearer token is configured on the client.
   */
  private authHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { ...extraHeaders };
    if (this.bearerToken) {
      headers["Authorization"] = `Bearer ${this.bearerToken}`;
    }
    return headers;
  }

  /**
   * Check gateway health.
   */
  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        headers: this.authHeaders(),
        signal: AbortSignal.timeout(2000),
      });
      return res.ok || res.status === 401;
    } catch {
      return false;
    }
  }

  /**
   * Send a streaming ReAct chat request to POST /api/corehub/chat/react
   */
  async streamChat(
    params: {
      sessionId?: string;
      prompt: string;
      messages: { role: string; content: string }[];
      executionProfile: PermissionMode;
      cwd?: string;
      model?: string;
      modelTier?: ModelTier;
      agentTeamwork?: boolean;
      credentials?: StreamChatCredentials;
      signal?: AbortSignal;
    },
    callbacks: StreamCallbacks,
  ): Promise<string> {
    const url = `${this.baseUrl}/api/corehub/chat/react`;
    let accumulatedReply = "";

    let effectiveModel = params.model;
    if (!effectiveModel && params.modelTier) {
      switch (params.modelTier) {
        case "Fast":
          effectiveModel = "claude-3-5-haiku-20241022";
          break;
        case "Balanced":
          effectiveModel = "claude-3-7-sonnet-20250219";
          break;
        case "High Reasoning":
          effectiveModel = "claude-3-7-sonnet-thought";
          break;
      }
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: this.authHeaders({
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        }),
        body: JSON.stringify({
          sessionId: params.sessionId,
          prompt: params.prompt,
          messages: params.messages,
          executionProfile: params.executionProfile,
          cwd: params.cwd,
          model: effectiveModel,
          agentTeamwork: params.agentTeamwork,
          apiKey: params.credentials?.customApiKey,
          anthropicApiKey: params.credentials?.anthropicApiKey,
          openAiApiKey: params.credentials?.openAiApiKey,
          geminiApiKey: params.credentials?.geminiApiKey,
          groqApiKey: params.credentials?.groqApiKey,
          localOllamaUrl: params.credentials?.localOllamaUrl,
          stream: true,
        }),
        signal: params.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        const err = new Error(`Gateway Error (${res.status}): ${errorText}`);
        callbacks.onError?.(err);
        throw err;
      }

      if (!res.body) {
        const err = new Error("Gateway returned empty stream body.");
        callbacks.onError?.(err);
        throw err;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      let stepCounter = 0;
      const inFlightStepIndexByTool = new Map<string, number>();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":")) continue;

          if (trimmed === "data: [DONE]") {
            callbacks.onDone?.(accumulatedReply);
            return accumulatedReply;
          }

          if (trimmed.startsWith("data: ")) {
            const jsonStr = trimmed.slice(6);
            try {
              const data = JSON.parse(jsonStr);

              // 1. Tool progress step (may be string or object)
              if (data.step && !data.choices) {
                let toolStep: ToolExecutionStep;

                if (typeof data.step === "string") {
                  const parsed = parseStepString(data.step);
                  if (parsed.status === "running") {
                    stepCounter++;
                    inFlightStepIndexByTool.set(parsed.tool, stepCounter);
                    toolStep = {
                      stepIndex: stepCounter,
                      tool: parsed.tool,
                      description: parsed.description,
                      status: "running",
                    };
                  } else {
                    const stepIdx = inFlightStepIndexByTool.get(parsed.tool) ?? ++stepCounter;
                    inFlightStepIndexByTool.delete(parsed.tool);
                    toolStep = {
                      stepIndex: stepIdx,
                      tool: parsed.tool,
                      description: parsed.description,
                      status: parsed.status,
                      durationMs: parsed.durationMs,
                    };
                  }
                } else {
                  const s = data.step;
                  toolStep = {
                    stepIndex: typeof s.stepIndex === "number" ? s.stepIndex : ++stepCounter,
                    tool: s.tool || s.phase || "Execution",
                    description: s.description,
                    input: s.input,
                    output: s.output,
                    status: s.status || "running",
                    durationMs: s.durationMs,
                    phase: s.phase,
                  };
                }

                callbacks.onStep?.(toolStep);
              }

              // 2. Concrete tool execution step (may be string or object)
              if (data.toolStep) {
                let toolStep: ToolExecutionStep;

                if (typeof data.toolStep === "string") {
                  const parsed = parseStepString(data.toolStep);
                  const stepIdx = inFlightStepIndexByTool.get(parsed.tool) ?? ++stepCounter;
                  inFlightStepIndexByTool.delete(parsed.tool);
                  toolStep = {
                    stepIndex: stepIdx,
                    tool: parsed.tool,
                    description: parsed.description,
                    status: parsed.status,
                    durationMs: parsed.durationMs,
                  };
                } else {
                  const ts = data.toolStep;
                  toolStep = {
                    stepIndex: typeof ts.stepIndex === "number" ? ts.stepIndex : ++stepCounter,
                    tool: ts.tool || "tool",
                    description: ts.description,
                    input: ts.input,
                    output: ts.output,
                    status: ts.status || "done",
                    durationMs: ts.durationMs,
                    phase: ts.phase,
                  };
                }

                callbacks.onToolStep?.(toolStep);
              }

              // 3. Final or delta choices
              if (data.choices && Array.isArray(data.choices)) {
                for (const choice of data.choices) {
                  const content = choice.delta?.content || choice.message?.content || "";
                  if (content) {
                    accumulatedReply += content;
                    callbacks.onDelta?.(content);
                  }
                }
              } else if (typeof data.reply === "string" && !accumulatedReply) {
                accumulatedReply = data.reply;
                callbacks.onDelta?.(data.reply);
              }
            } catch {
              // Ignore partial JSON parse errors in stream
            }
          }
        }
      }

      callbacks.onDone?.(accumulatedReply);
      return accumulatedReply;
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") {
        callbacks.onDone?.(accumulatedReply);
        return accumulatedReply;
      }
      callbacks.onError?.(err as Error);
      throw err;
    }
  }

  /**
   * Fetch Memory Wiki Layers from GET /api/cory/layers
   * Handles { ok: true, count, items: [...] } from microkernel-services.ts
   */
  async getMemoryLayers(): Promise<CoryMemoryLayer[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/cory/layers`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return [];
      const data = await res.json();

      if (Array.isArray(data)) return data;

      // Primary microkernel contract: { ok: true, count, items: [...] }
      if (data && Array.isArray(data.items)) {
        const layerGroups = new Map<string, { count: number; contents: string[]; updatedAt?: string }>();

        for (const item of data.items) {
          const layerName = String(item.layer || "general");
          const existing = layerGroups.get(layerName) ?? { count: 0, contents: [] };
          existing.count++;
          if (item.content && existing.contents.length < 3) {
            existing.contents.push(String(item.content));
          }
          if (item.updatedAt) {
            existing.updatedAt = String(item.updatedAt);
          }
          layerGroups.set(layerName, existing);
        }

        const result: CoryMemoryLayer[] = [];
        for (const [layer, info] of layerGroups.entries()) {
          result.push({
            layer,
            count: info.count,
            summary: info.contents.join(" • ").slice(0, 140) || `${info.count} items in ${layer} layer`,
            updatedAt: info.updatedAt,
          });
        }
        return result;
      }

      if (data && Array.isArray(data.layers)) return data.layers;

      return [];
    } catch {
      return [];
    }
  }

  /**
   * Search Memory Wiki from GET /api/cory/search?q={query}
   * Handles { ok: true, hits: [...] } from microkernel-services.ts
   */
  async searchMemory(query: string): Promise<CoryMemoryItem[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/cory/search?q=${encodeURIComponent(query)}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return [];
      const data = await res.json();

      const rawList = Array.isArray(data)
        ? data
        : Array.isArray(data?.hits)
          ? data.hits
          : Array.isArray(data?.results)
            ? data.results
            : [];

      return rawList.map((hit: any, idx: number) => {
        const item = hit.item ?? hit;
        return {
          id: String(item.id || `hit_${idx}`),
          layer: String(item.layer || "general"),
          title: String(item.title || item.content?.slice(0, 48) || item.layer || "Memory"),
          content: String(item.content || ""),
          score: typeof hit.score === "number" ? hit.score : item.score,
          tags: Array.isArray(item.tags) ? item.tags : undefined,
          createdAt: item.createdAt || item.updatedAt,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Fetch full Cory profile (GET /api/cory/profile)
   */
  async getCoryProfile(): Promise<CoryProfilePayload | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/cory/profile`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Remember/store an item directly into Cory (POST /api/cory/remember)
   */
  async rememberMemory(
    content: string,
    layer: "identity" | "durable" | "constraint" | "episodic" = "durable",
    tags?: string[],
    workspaceId?: string,
  ): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/cory/remember`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, layer, tags, workspaceId }),
        signal: AbortSignal.timeout(4000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Delete a memory item by ID (DELETE /api/cory/items/:id)
   */
  async forgetMemory(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/cory/items/${encodeURIComponent(id)}`, {
        method: "DELETE",
        signal: AbortSignal.timeout(4000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Resolve a pending memory proposal (POST /api/cory/proposals/:id/resolve)
   */
  async resolveMemoryProposal(id: string, decision: "approve" | "dismiss"): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/cory/proposals/${encodeURIComponent(id)}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
        signal: AbortSignal.timeout(4000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Compile Cory memory + dialectic profile into Knowledge Wiki (POST /api/cory/wiki/compile)
   */
  async compileMemoryWiki(): Promise<{ ok: boolean; path: string; markdown: string } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/cory/wiki/compile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Fetch CoreHub Storefront from GET /api/corehub/storefront
   * Handles { ok: true, cards: [...], apps: [...] } from microkernel-services.ts
   */
  async getStorefront(): Promise<CoreHubSkill[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/storefront`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return [];
      const data = await res.json();

      const rawList = Array.isArray(data)
        ? data
        : Array.isArray(data?.cards)
          ? data.cards
          : Array.isArray(data?.apps)
            ? data.apps
            : Array.isArray(data?.skills)
              ? data.skills
              : Array.isArray(data?.plugins)
                ? data.plugins
                : [];

      return rawList.map((card: any) => ({
        id: String(card.id || card.appId || card.cardId || "unknown"),
        name: String(card.name || card.title || card.appName || "Skill"),
        description: String(card.description || card.summary || card.headline || ""),
        category: String(card.category || card.tier || "General"),
        author: String(card.author || card.publisher || "CoreBlow"),
        version: String(card.version || "2.1.2"),
        installed: Boolean(card.installed || card.enabled),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Fetch Learned Skills from GET /api/corehub/skills/learned
   * Handles { ok: true, count, skills: [...] } from microkernel-services.ts
   */
  async getLearnedSkills(): Promise<CoreHubSkill[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/skills/learned`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return [];
      const data = await res.json();

      const rawList = Array.isArray(data)
        ? data
        : Array.isArray(data?.skills)
          ? data.skills
          : Array.isArray(data?.learnedSkills)
            ? data.learnedSkills
            : [];

      return rawList.map((s: any) => ({
        id: String(s.id || s.skillId || "learned"),
        name: String(s.name || s.title || "Learned Skill"),
        description: String(s.description || s.summary || ""),
        category: String(s.category || "Learned"),
        version: String(s.version || "1.0.0"),
        installed: s.status === "verified_active" || s.enabled !== false,
      }));
    } catch {
      return [];
    }
  }

  /**
   * 1-Click Install or Enable Storefront Item (POST /api/corehub/storefront/:id/install)
   */
  async installStorefrontItem(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/storefront/${encodeURIComponent(id)}/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Uninstall or Disable Storefront Item (POST /api/corehub/storefront/:id/uninstall)
   */
  async uninstallStorefrontItem(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/storefront/${encodeURIComponent(id)}/uninstall`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Toggle a Learned Skill (POST /api/corehub/skills/:id/toggle)
   */
  async toggleLearnedSkill(id: string, enabled?: boolean): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/skills/${encodeURIComponent(id)}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
        signal: AbortSignal.timeout(4000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Direct Patch a Learned Skill (POST /api/corehub/skills/:id/patch)
   */
  async patchLearnedSkill(
    id: string,
    updates: {
      instructions?: string;
      description?: string;
      triggers?: string[];
      procedure?: string[];
    },
  ): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/skills/${encodeURIComponent(id)}/patch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        signal: AbortSignal.timeout(4000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fetch Multi-Key Credential Pools & Telemetry (GET /api/corehub/providers/pools)
   */
  async getCredentialPools(): Promise<CredentialPoolPayload | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/providers/pools`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Add or Update Key in Credential Pool (POST /api/corehub/providers/pools/keys)
   */
  async addCredentialPoolKey(params: {
    providerId: string;
    apiKey: string;
    label?: string;
    priority?: number;
  }): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/providers/pools/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(4000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Remove a Key from Credential Pool (DELETE /api/corehub/providers/pools/keys/:keyId)
   */
  async deleteCredentialPoolKey(keyId: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/providers/pools/keys/${encodeURIComponent(keyId)}`, {
        method: "DELETE",
        signal: AbortSignal.timeout(4000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Save Ordered Provider Fallback Chain (POST /api/corehub/providers/fallback-chain)
   */
  async saveFallbackChain(chain: string[]): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/providers/fallback-chain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chain }),
        signal: AbortSignal.timeout(4000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * List sessions from Gateway Unified Session Store (GET /api/corehub/sessions).
   */
  async listSessions(query?: string, limit?: number): Promise<ChatThread[]> {
    try {
      const q = query ? `?query=${encodeURIComponent(query)}&limit=${limit ?? 30}` : `?limit=${limit ?? 30}`;
      const res = await fetch(`${this.baseUrl}/api/corehub/sessions${q}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data?.sessions)) return [];

      return data.sessions.map((s: any): ChatThread => ({
        id: String(s.id),
        title: String(s.title || "Untitled Conversation"),
        createdAt: typeof s.createdAt === "number" ? s.createdAt : Date.now(),
        updatedAt: typeof s.updatedAt === "number" ? s.updatedAt : Date.now(),
        cwd: s.cwd,
        executionProfile: (s.executionProfile as PermissionMode) || "Full access",
        model: s.model || "High Reasoning",
        messages: Array.isArray(s.messages)
          ? s.messages.map((m: any): ChatMessage => ({
              id: String(m.id || `msg_${Date.now()}`),
              role: m.role || "user",
              content: String(m.content || ""),
              timestamp: typeof m.createdAt === "number" ? m.createdAt : (m.timestamp || Date.now()),
              attachedFiles: Array.isArray(m.attachedFiles) ? m.attachedFiles : undefined,
              toolSteps: Array.isArray(m.toolSteps)
                ? m.toolSteps.map((stepStr: string, idx: number) => {
                    if (typeof stepStr === "string") {
                      const parsed = parseStepString(stepStr);
                      return {
                        stepIndex: idx + 1,
                        tool: parsed.tool,
                        description: parsed.description,
                        status: parsed.status,
                        durationMs: parsed.durationMs,
                      };
                    }
                    return stepStr;
                  })
                : undefined,
            }))
          : [],
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get single session from Gateway (GET /api/corehub/sessions/:id).
   */
  async getSession(id: string): Promise<ChatThread | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/sessions/${encodeURIComponent(id)}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data?.session) return null;
      const s = data.session;
      return {
        id: String(s.id),
        title: String(s.title || "Untitled"),
        createdAt: s.createdAt || Date.now(),
        updatedAt: s.updatedAt || Date.now(),
        cwd: s.cwd,
        executionProfile: (s.executionProfile as PermissionMode) || "Full access",
        model: s.model || "High Reasoning",
        messages: (s.messages || []).map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.createdAt || Date.now(),
          attachedFiles: m.attachedFiles,
        })),
      };
    } catch {
      return null;
    }
  }

  /**
   * Upsert session to Gateway (POST /api/corehub/sessions).
   */
  async saveSession(thread: ChatThread): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: thread.id,
          title: thread.title,
          createdAt: thread.createdAt,
          updatedAt: thread.updatedAt,
          cwd: thread.cwd,
          executionProfile: thread.executionProfile,
          model: thread.model,
          surface: "desktop",
          messages: thread.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.timestamp,
            attachedFiles: m.attachedFiles,
            toolSteps: m.toolSteps?.map((ts) =>
              ts.status === "done" && ts.durationMs
                ? `✓ ${ts.tool}${ts.description ? ` · ${ts.description}` : ""} (${ts.durationMs}ms)`
                : `${ts.tool}: ${ts.description ?? ts.status}`,
            ),
          })),
        }),
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Delete session from Gateway (DELETE /api/corehub/sessions/:id).
   */
  async deleteSession(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/sessions/${encodeURIComponent(id)}`, {
        method: "DELETE",
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * List available War Rooms.
   */
  async listWarRooms(): Promise<Array<{ roomId: string; title: string; purpose: string }>> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/warroom/rooms`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return [];
      const json = await res.json();
      return json.rooms ?? [];
    } catch {
      return [];
    }
  }

  /**
   * Get full state of a War Room (messages, roster, Kanban cards, pending approvals, recent frames).
   */
  async getWarRoomState(roomId: string = "coreblow-squad"): Promise<WarRoomState | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/warroom/${encodeURIComponent(roomId)}/messages`, {
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return {
        roomId: json.roomId ?? roomId,
        title: json.title ?? "CoreBlow Squad",
        purpose: json.purpose ?? "Unified Autonomous Multi-Agent Squad",
        leadAgentId: json.leadAgentId ?? "agent-lead",
        members: json.members ?? [],
        kanbanBoard: json.kanbanBoard ?? [],
        pendingApprovals: json.pendingApprovals ?? [],
        messages: json.messages ?? [],
        screenFeed: json.screenFeed ?? [],
      };
    } catch {
      return null;
    }
  }

  /**
   * Send a squad group chat message with @mention / @all parallel dispatch.
   */
  async postWarRoomMessage(
    roomId: string = "coreblow-squad",
    content: string,
    cwd?: string,
  ): Promise<{ userMessage: WarRoomChatMessage; replies: WarRoomChatMessage[]; room: WarRoomState } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/warroom/${encodeURIComponent(roomId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, cwd }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Approve or deny a child tool execution approval request.
   */
  async resolveWarRoomApproval(
    roomId: string = "coreblow-squad",
    approvalId: string,
    decision: "approved" | "denied",
  ): Promise<boolean> {
    try {
      const res = await fetch(
        `${this.baseUrl}/api/corehub/warroom/${encodeURIComponent(roomId)}/approvals/${encodeURIComponent(approvalId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
          signal: AbortSignal.timeout(4000),
        },
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Subscribe to real-time Live Agent Screen SSE stream.
   */
  subscribeWarRoomScreen(
    roomId: string = "coreblow-squad",
    onFrame: (frame: AgentScreenFrame) => void,
  ): () => void {
    const url = `${this.baseUrl}/api/corehub/warroom/${encodeURIComponent(roomId)}/screen/stream`;

    if (typeof EventSource !== "undefined") {
      const es = new EventSource(url);
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.frame) {
            onFrame(data.frame);
          }
        } catch {}
      };
      return () => {
        es.close();
      };
    }

    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok || !res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data:")) {
              const dataStr = trimmed.slice(5).trim();
              if (dataStr) {
                try {
                  const data = JSON.parse(dataStr);
                  if (data?.frame) {
                    onFrame(data.frame);
                  }
                } catch {}
              }
            }
          }
        }
      })
      .catch(() => {});

    return () => {
      controller.abort();
    };
  }

  /**
   * List all configured local and remote nodes from GET /api/corehub/nodes
   */
  async listNodes(options?: { probe?: boolean }): Promise<RemoteNodeConfig[]> {
    try {
      const probeParam = options?.probe === false ? "?probe=false" : "";
      const res = await fetch(`${this.baseUrl}/api/corehub/nodes${probeParam}`, {
        method: "GET",
        headers: this.authHeaders({ Accept: "application/json" }),
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { ok?: boolean; nodes?: RemoteNodeConfig[] };
      return Array.isArray(data?.nodes) ? data.nodes : [];
    } catch {
      return [];
    }
  }

  /**
   * Add or update a remote gateway node via POST /api/corehub/nodes
   */
  async saveRemoteNode(node: Partial<RemoteNodeConfig> & { name: string; url: string }): Promise<{ ok: boolean; node?: RemoteNodeConfig; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/nodes`, {
        method: "POST",
        headers: this.authHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
        body: JSON.stringify(node),
        signal: AbortSignal.timeout(5000),
      });
      const data = (await res.json()) as { ok?: boolean; node?: RemoteNodeConfig; error?: string };
      return { ok: res.ok && !!data?.ok, node: data?.node, error: data?.error };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Remove a remote gateway node via DELETE /api/corehub/nodes/:id
   */
  async deleteRemoteNode(id: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/nodes/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: this.authHeaders({ Accept: "application/json" }),
        signal: AbortSignal.timeout(4000),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      return { ok: res.ok && !!data?.ok, error: data?.error };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Probe an immediate latency and health check via POST /api/corehub/nodes/:id/probe
   */
  async probeNode(id: string): Promise<{ ok: boolean; latencyMs?: number; healthy?: boolean; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/nodes/${encodeURIComponent(id)}/probe`, {
        method: "POST",
        headers: this.authHeaders({ Accept: "application/json" }),
        signal: AbortSignal.timeout(4000),
      });
      const data = (await res.json()) as { ok?: boolean; latencyMs?: number; healthy?: boolean; error?: string };
      return { ok: res.ok && !!data?.ok, latencyMs: data?.latencyMs, healthy: data?.healthy, error: data?.error };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Trigger bidirectional session synchronization with target node via POST /api/corehub/nodes/:id/sync-sessions
   */
  async syncNodeSessions(id: string): Promise<{ ok: boolean; syncedCount?: number; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/nodes/${encodeURIComponent(id)}/sync-sessions`, {
        method: "POST",
        headers: this.authHeaders({ Accept: "application/json" }),
        signal: AbortSignal.timeout(10000),
      });
      const data = (await res.json()) as { ok?: boolean; syncedCount?: number; error?: string };
      return { ok: res.ok && !!data?.ok, syncedCount: data?.syncedCount, error: data?.error };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Transcribe recorded audio via POST /api/corehub/voice/transcribe
   */
  async transcribeVoice(params: { audioBase64: string; mimeType?: string; language?: string }): Promise<VoiceTranscribeResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/voice/transcribe`, {
        method: "POST",
        headers: this.authHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(20000),
      });
      const data = (await res.json()) as VoiceTranscribeResponse;
      return { ok: res.ok && !!data?.ok, text: data?.text, engine: data?.engine, durationMs: data?.durationMs, fallbackHint: data?.fallbackHint, error: data?.error };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Synthesize text to speech via POST /api/corehub/voice/speak
   */
  async synthesizeVoice(params: { text: string; voice?: string; rate?: number }): Promise<VoiceSpeakResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/voice/speak`, {
        method: "POST",
        headers: this.authHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(10000),
      });
      const data = (await res.json()) as VoiceSpeakResponse;
      return { ok: res.ok && !!data?.ok, mode: data?.mode, text: data?.text, voice: data?.voice, rate: data?.rate, audioBase64: data?.audioBase64, format: data?.format, engine: data?.engine, error: data?.error };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * List recent file snapshots / checkpoints via GET /api/corehub/checkpoints
   */
  async listCheckpoints(sessionId?: string): Promise<{ ok: boolean; count: number; checkpoints: any[]; error?: string }> {
    try {
      const qs = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
      const res = await fetch(`${this.baseUrl}/api/corehub/checkpoints${qs}`, {
        headers: this.authHeaders({ Accept: "application/json" }),
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      return { ok: res.ok && !!data?.ok, count: data?.count ?? 0, checkpoints: data?.checkpoints ?? [], error: data?.error };
    } catch (err) {
      return { ok: false, count: 0, checkpoints: [], error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Rollback file checkpoint via POST /api/corehub/checkpoints/rollback
   */
  async rollbackCheckpoint(params?: { checkpointId?: string; sessionId?: string }): Promise<{ ok: boolean; message?: string; rolledBack?: any; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/checkpoints/rollback`, {
        method: "POST",
        headers: this.authHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
        body: JSON.stringify(params ?? {}),
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json();
      return { ok: res.ok && !!data?.ok, message: data?.message, rolledBack: data?.rolledBack, error: data?.error };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Get Global Emergency Stop state via GET /api/corehub/system/estop
   */
  async getEstopState(): Promise<{ ok: boolean; paused: boolean; reason?: string; pausedAt?: number; resumedAt?: number }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/system/estop`, {
        headers: this.authHeaders({ Accept: "application/json" }),
        signal: AbortSignal.timeout(3000),
      });
      const data = await res.json();
      return { ok: res.ok, paused: Boolean(data?.paused), reason: data?.reason, pausedAt: data?.pausedAt, resumedAt: data?.resumedAt };
    } catch {
      return { ok: false, paused: false };
    }
  }

  /**
   * Set Global Emergency Stop (pause/resume) via POST /api/corehub/system/estop
   */
  async setEstopPaused(paused: boolean, reason?: string): Promise<{ ok: boolean; paused: boolean; reason?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/system/estop`, {
        method: "POST",
        headers: this.authHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
        body: JSON.stringify({ paused, reason }),
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      return { ok: res.ok && !!data?.ok, paused: Boolean(data?.paused), reason: data?.reason };
    } catch (err) {
      return { ok: false, paused, reason: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * List installed MCP servers and catalog via GET /api/corehub/mcp/servers
   */
  async listMcpServers(): Promise<{ ok: boolean; servers: any[]; catalog: any[]; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/mcp/servers`, {
        headers: this.authHeaders({ Accept: "application/json" }),
        signal: AbortSignal.timeout(4000),
      });
      const data = await res.json();
      return { ok: res.ok && !!data?.ok, servers: data?.servers ?? [], catalog: data?.catalog ?? [], error: data?.error };
    } catch (err) {
      return { ok: false, servers: [], catalog: [], error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Install or configure an MCP server via POST /api/corehub/mcp/servers
   */
  async installMcpServer(payload: { catalogId?: string; id?: string; name?: string; command?: string; args?: string[]; transport?: string; url?: string; env?: Record<string, string> }): Promise<{ ok: boolean; server?: any; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/mcp/servers`, {
        method: "POST",
        headers: this.authHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(6000),
      });
      const data = await res.json();
      return { ok: res.ok && !!data?.ok, server: data?.server, error: data?.error };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Delete an MCP server via DELETE /api/corehub/mcp/servers/:id
   */
  async deleteMcpServer(id: string): Promise<{ ok: boolean; deleted?: boolean; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/mcp/servers/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: this.authHeaders({ Accept: "application/json" }),
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      return { ok: res.ok && !!data?.ok, deleted: data?.deleted, error: data?.error };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Probe an MCP server's connectivity via POST /api/corehub/mcp/servers/:id/probe
   */
  async probeMcpServer(id: string): Promise<{ ok: boolean; probe?: any; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/mcp/servers/${encodeURIComponent(id)}/probe`, {
        method: "POST",
        headers: this.authHeaders({ Accept: "application/json" }),
        signal: AbortSignal.timeout(6000),
      });
      const data = await res.json();
      return { ok: res.ok && !!data?.ok, probe: data?.probe, error: data?.error };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * List bot pairing requests and approved users via GET /api/corehub/pairing
   */
  async listPairingState(): Promise<{ ok: boolean; pending: any[]; approved: any[]; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/pairing`, {
        headers: this.authHeaders({ Accept: "application/json" }),
        signal: AbortSignal.timeout(4000),
      });
      const data = await res.json();
      return { ok: res.ok && !!data?.ok, pending: data?.pending ?? [], approved: data?.approved ?? [], error: data?.error };
    } catch (err) {
      return { ok: false, pending: [], approved: [], error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Approve a pending bot pairing code via POST /api/corehub/pairing/approve
   */
  async approvePairing(codeOrId: string): Promise<{ ok: boolean; approved?: boolean; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/pairing/approve`, {
        method: "POST",
        headers: this.authHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
        body: JSON.stringify({ codeOrId }),
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      return { ok: res.ok && !!data?.ok, approved: data?.approved, error: data?.error };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Revoke approval for a paired user via POST /api/corehub/pairing/revoke
   */
  async revokePairing(externalUserId: string): Promise<{ ok: boolean; revoked?: boolean; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/pairing/revoke`, {
        method: "POST",
        headers: this.authHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
        body: JSON.stringify({ externalUserId }),
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      return { ok: res.ok && !!data?.ok, revoked: data?.revoked, error: data?.error };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * List channels configuration and status via GET /api/corehub/channels
   */
  async listChannels(): Promise<{ ok: boolean; channels: any[]; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/channels`, {
        headers: this.authHeaders({ Accept: "application/json" }),
        signal: AbortSignal.timeout(4000),
      });
      const data = await res.json();
      return { ok: res.ok && !!data?.ok, channels: data?.channels ?? [], error: data?.error };
    } catch (err) {
      return { ok: false, channels: [], error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Configure a messaging channel via POST /api/corehub/channels/:platform/configure
   */
  async configureChannel(platform: string, payload: { token?: string; enabled?: boolean }): Promise<{ ok: boolean; channel?: any; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/channels/${encodeURIComponent(platform)}/configure`, {
        method: "POST",
        headers: this.authHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      return { ok: res.ok && !!data?.ok, channel: data?.channel, error: data?.error };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Test a messaging channel's token and connectivity via POST /api/corehub/channels/:platform/test
   */
  async testChannel(platform: string, token?: string): Promise<{ ok: boolean; status?: string; message?: string; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/channels/${encodeURIComponent(platform)}/test`, {
        method: "POST",
        headers: this.authHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
        body: JSON.stringify({ token }),
        signal: AbortSignal.timeout(6000),
      });
      const data = await res.json();
      return { ok: res.ok && !!data?.ok, status: data?.status, message: data?.message, error: data?.error };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Audit a skill statically using AST & regex security guard via POST /api/corehub/skills/audit
   */
  async auditSkill(content: string, sourceName?: string): Promise<{ ok: boolean; audit?: any; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/corehub/skills/audit`, {
        method: "POST",
        headers: this.authHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
        body: JSON.stringify({ content, sourceName }),
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      return { ok: res.ok && !!data?.ok, audit: data?.audit, error: data?.error };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const gatewayClient = new CoreBlowGatewayClient();
