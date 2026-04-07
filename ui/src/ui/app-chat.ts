import type { CoreBlowApp } from "./app.ts";
import { generateUUID } from "./uuid.ts";

// ─── Types ───────────────────────────────────────────────────────

export type ChatMessage = {
   id: string;
   role: "user" | "assistant" | "system";
   content: string;
   ts: number;
   streaming?: boolean;
   toolCalls?: ToolStreamEntry[];
};

export type ToolStreamEntry = {
   toolCallId: string;
   name: string;
   phase: "start" | "update" | "result";
   args?: unknown;
   output?: string;
   durationMs?: number;
   startedAt: number;
};

export type ChatEventPayload = {
   state: "delta" | "final" | "error" | "aborted";
   sessionKey?: string;
   runId?: string;
   message?: { text?: string; role?: string; content?: Array<{ type: string; text?: string }>; };
   usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
   turnNumber?: number;
   durationMs?: number;
   ts?: number;
};

export type AgentEventPayload = {
   stream: "tool" | "compaction" | "lifecycle";
   sessionKey?: string;
   runId?: string;
   ts?: number;
   data?: {
      toolCallId?: string;
      name?: string;
      phase?: string;
      args?: unknown;
      result?: string;
      partialResult?: string;
      durationMs?: number;
   };
};

// ─── Chat Controller ─────────────────────────────────────────────

export class ChatController {
   messages: ChatMessage[] = [];
   sessionKey: string = "";
   chatStream: string | null = null;
   chatRunId: string | null = null;
   chatSending = false;
   toolStream = new Map<string, ToolStreamEntry>();
   toolStreamOrder: string[] = [];

   constructor(private app: CoreBlowApp) {
      // Restore session from settings
      this.sessionKey = this.app.settings.sessionKey || "";
   }

   get isBusy(): boolean {
      return this.chatSending || Boolean(this.chatRunId);
   }

   // ─── Send Message ─────────────────────────────────────────────

   async send(text: string) {
      const trimmed = text.trim();
      if (!trimmed || this.isBusy) return;

      // Add user message
      const userMsg: ChatMessage = { id: generateUUID(), role: "user", content: trimmed, ts: Date.now() };
      this.messages = [...this.messages, userMsg];
      this.app.requestUpdate();

      const client = this.app.gateway.getClient();
      if (!client || !client.connected) {
         this.messages = [...this.messages, {
            id: generateUUID(), role: "system", ts: Date.now(),
            content: "⚠️ Not connected to Gateway."
         }];
         this.app.requestUpdate();
         return;
      }

      // Set streaming state
      this.chatSending = true;
      this.chatStream = "";
      this.chatRunId = null;
      this.toolStream.clear();
      this.toolStreamOrder = [];
      this.app.requestUpdate();

      try {
         const res = await client.request<{ status: string; runId: string; sessionId: string }>(
            "chat.send", { sessionKey: this.sessionKey || undefined, message: trimmed }
         );

         if (res?.runId) {
            this.chatRunId = res.runId;
            this.sessionKey = res.sessionId ?? this.sessionKey;
            // Persist session key
            this.app.applySettings({ ...this.app.settings, sessionKey: this.sessionKey });
         }

         this.chatSending = false;
         this.app.requestUpdate();
      } catch (err: unknown) {
         const msg = err instanceof Error ? err.message : String(err);
         this.chatSending = false;
         this.chatRunId = null;
         this.chatStream = null;
         this.messages = [...this.messages, {
            id: generateUUID(), role: "system", ts: Date.now(),
            content: `**Error**: ${msg}`
         }];
         this.app.requestUpdate();
      }
   }

   // ─── Abort ────────────────────────────────────────────────────

   async abort() {
      if (!this.sessionKey) return;
      const client = this.app.gateway.getClient();
      if (client?.connected) {
         await client.request("chat.abort", { sessionKey: this.sessionKey }).catch(() => {});
      }
   }

   // ─── Handle Gateway Events (OpenClaw pattern) ─────────────────

   handleChatEvent(payload: ChatEventPayload) {
      if (!payload) return;
      // Filter by session
      if (payload.sessionKey && payload.sessionKey !== this.sessionKey) return;
      // Filter by run
      if (payload.runId && this.chatRunId && payload.runId !== this.chatRunId) return;

      if (payload.state === "delta") {
         const text = payload.message?.text ?? "";
         if (text && text.length >= (this.chatStream?.length ?? 0)) {
            this.chatStream = text;
         }
         this.app.requestUpdate();

      } else if (payload.state === "final") {
         // Commit streamed text as assistant message
         const finalText = this.extractFinalText(payload);
         if (finalText) {
            const toolCalls = this.collectToolCalls();
            this.messages = [...this.messages, {
               id: generateUUID(), role: "assistant", content: finalText, ts: Date.now(),
               toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            }];
         }
         this.resetStreamState();
         this.app.requestUpdate();

      } else if (payload.state === "error") {
         const errorText = payload.message?.text ?? "Unknown error";
         this.messages = [...this.messages, {
            id: generateUUID(), role: "system", ts: Date.now(),
            content: `⚠️ ${errorText}`
         }];
         this.resetStreamState();
         this.app.requestUpdate();

      } else if (payload.state === "aborted") {
         // Commit partial stream if any
         if (this.chatStream?.trim()) {
            this.messages = [...this.messages, {
               id: generateUUID(), role: "assistant", content: this.chatStream + " *(aborted)*",
               ts: Date.now(),
            }];
         }
         this.resetStreamState();
         this.app.requestUpdate();
      }
   }

   handleAgentEvent(payload: AgentEventPayload) {
      if (!payload || payload.stream !== "tool") return;
      if (payload.sessionKey && payload.sessionKey !== this.sessionKey) return;

      const data = payload.data;
      if (!data?.toolCallId) return;

      const id = data.toolCallId;
      const phase = (data.phase ?? "start") as "start" | "update" | "result";

      let entry = this.toolStream.get(id);
      if (!entry) {
         entry = {
            toolCallId: id,
            name: data.name ?? "tool",
            phase,
            args: data.args,
            output: undefined,
            startedAt: payload.ts ?? Date.now(),
         };
         this.toolStream.set(id, entry);
         this.toolStreamOrder.push(id);
      }

      entry.phase = phase;
      if (data.args !== undefined) entry.args = data.args;
      if (phase === "result" || phase === "update") {
         entry.output = (data.result ?? data.partialResult ?? entry.output) as string | undefined;
      }
      if (data.durationMs !== undefined) entry.durationMs = data.durationMs;

      this.app.requestUpdate();
   }

   // ─── Helpers ──────────────────────────────────────────────────

   private extractFinalText(payload: ChatEventPayload): string {
      // Try content array first (OpenClaw format)
      if (payload.message?.content && Array.isArray(payload.message.content)) {
         return payload.message.content
            .filter(c => c.type === 'text')
            .map(c => c.text ?? '')
            .join('');
      }
      // Fallback to text field
      if (payload.message?.text) return payload.message.text;
      // Fallback to streamed text
      return this.chatStream?.trim() ?? "";
   }

   private collectToolCalls(): ToolStreamEntry[] {
      return this.toolStreamOrder
         .map(id => this.toolStream.get(id))
         .filter((e): e is ToolStreamEntry => Boolean(e));
   }

   private resetStreamState() {
      this.chatStream = null;
      this.chatRunId = null;
      this.chatSending = false;
      this.toolStream.clear();
      this.toolStreamOrder = [];
   }

   clear() {
      this.messages = [];
      this.resetStreamState();
      this.app.requestUpdate();
   }

   newSession() {
      this.sessionKey = "";
      this.clear();
      this.app.applySettings({ ...this.app.settings, sessionKey: "" });
   }
}
