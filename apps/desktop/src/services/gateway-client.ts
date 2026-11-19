import type {
  AgentScreenFrame,
  ChatMessage,
  ChatThread,
  CoryMemoryItem,
  CoryMemoryLayer,
  CoreHubSkill,
  ModelTier,
  PermissionMode,
  ToolExecutionStep,
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

  constructor(baseUrl: string = GATEWAY_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  /**
   * Check gateway health.
   */
  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
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
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          sessionId: params.sessionId,
          prompt: params.prompt,
          messages: params.messages,
          executionProfile: params.executionProfile,
          cwd: params.cwd,
          model: effectiveModel,
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
        version: String(card.version || "2.0.0"),
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
        installed: true,
      }));
    } catch {
      return [];
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
}

export const gatewayClient = new CoreBlowGatewayClient();
