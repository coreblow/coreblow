import { LitElement, html } from "lit";
import { customElement, property, state, query } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import type { CoreBlowApp } from "../app.ts";
import { renderMarkdown } from "../markdown.ts";
import type { ChatMessage, ToolStreamEntry } from "../app-chat.ts";
import { resolveChatModelSelectState, switchChatModel } from "../chat-model-select.ts";
import type { ApprovalDecision } from "./tool-approval-modal.ts";
import "./tool-approval-modal.ts";

@customElement("coreblow-chat-view")
export class ChatView extends LitElement {
  @property({ attribute: false }) app!: CoreBlowApp;
  @query(".chat-history") historyEl!: HTMLElement;

  @state() inputText = "";

  createRenderRoot() {
    return this; // light DOM
  }

  private handleSend() {
     const text = this.inputText.trim();
     if (!text) return;
     this.inputText = "";
     this.app.chat.send(text);
  }

  private handleKeyDown(e: KeyboardEvent) {
     if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
     }
  }

  private handleAbort() {
     this.app.chat.abort();
  }

  private handleNewSession() {
     this.app.chat.newSession();
  }

  private async handleModelChange(e: Event) {
     const next = (e.target as HTMLSelectElement).value.trim();
     const client = this.app.gateway.getClient();
     if (!client?.connected || !this.app.chat.sessionKey) return;
     this.app.chatModelOverrides = await switchChatModel(
        client, this.app.chat.sessionKey, next, this.app.chatModelOverrides
     );
  }

  private handleApprovalDecision(id: string, decision: ApprovalDecision) {
     // Remove from queue
     this.app.approvalQueue = this.app.approvalQueue.filter(e => e.id !== id);
     // Send decision to gateway
     const client = this.app.gateway.getClient();
     if (client?.connected) {
        client.request("tools.approve", { id, decision }).catch(() => {});
     }
  }

  updated() {
     if (this.historyEl) {
        this.historyEl.scrollTop = this.historyEl.scrollHeight;
     }
  }

  // ─── Tool Card ────────────────────────────────────────────────

  private renderToolCard(tool: ToolStreamEntry) {
     const isRunning = tool.phase === "start" || tool.phase === "update";
     const icon = isRunning ? "⏳" : "✅";
     const statusClass = isRunning ? "tool-card--running" : "tool-card--done";

     return html`
       <div class="tool-card ${statusClass}">
          <div class="tool-card-header">
             <span class="tool-card-icon">${icon}</span>
             <span class="tool-card-name">${tool.name}</span>
             ${tool.durationMs != null ? html`<span class="tool-card-duration">${tool.durationMs}ms</span>` : ""}
          </div>
          ${tool.args ? html`
             <details class="tool-card-args">
                <summary>Arguments</summary>
                <pre>${typeof tool.args === "string" ? tool.args : JSON.stringify(tool.args, null, 2)}</pre>
             </details>
          ` : ""}
          ${tool.output ? html`
             <div class="tool-card-output">
                <pre>${tool.output.length > 500 ? tool.output.slice(0, 500) + "…" : tool.output}</pre>
             </div>
          ` : ""}
       </div>
     `;
  }

  // ─── Message ──────────────────────────────────────────────────

  private renderMessage(msg: ChatMessage) {
     const isUser = msg.role === "user";
     const isSystem = msg.role === "system";

     return html`
       <div class="chat-message chat-message--${msg.role}" style="display: flex; gap: 12px; ${isUser ? 'flex-direction: row-reverse' : ''}">
          <div class="chat-avatar" style="width: 32px; height: 32px; border-radius: 50%; background: ${isUser ? 'var(--accent)' : isSystem ? 'var(--warning, #f59e0b)' : 'var(--bg-elevated)'}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
             ${isUser ? "👤" : isSystem ? "⚠️" : "🐙"}
          </div>
          <div class="chat-bubble" style="background: ${isUser ? 'var(--accent)' : 'var(--bg-elevated)'}; color: ${isUser ? 'var(--primary-foreground)' : 'var(--foreground)'}; padding: 12px 16px; border-radius: var(--radius-md); max-width: 80%;">
             ${unsafeHTML(renderMarkdown(msg.content))}
             ${msg.toolCalls?.map(tc => this.renderToolCard(tc)) ?? ""}
          </div>
       </div>
     `;
  }

  // ─── Streaming Indicator ──────────────────────────────────────

  private renderStreamingState() {
     const chat = this.app.chat;
     if (!chat.chatRunId && !chat.chatSending) return "";

     const activeTools = chat.toolStreamOrder
        .map(id => chat.toolStream.get(id))
        .filter((e): e is ToolStreamEntry => Boolean(e));

     return html`
       <div class="chat-message chat-message--assistant" style="display: flex; gap: 12px;">
          <div class="chat-avatar" style="width: 32px; height: 32px; border-radius: 50%; background: var(--bg-elevated); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
             🐙
          </div>
          <div class="chat-bubble streaming-bubble" style="background: var(--bg-elevated); padding: 12px 16px; border-radius: var(--radius-md); max-width: 80%;">
             ${chat.chatStream ? unsafeHTML(renderMarkdown(chat.chatStream)) : html`<span class="typing-dots"><span>·</span><span>·</span><span>·</span></span>`}
             ${activeTools.map(tc => this.renderToolCard(tc))}
             <span class="stream-cursor">▍</span>
          </div>
       </div>
     `;
  }

  // ─── Model Dropdown ───────────────────────────────────────────

  private renderModelSelect() {
     const busy = this.app.chat.isBusy;
     const loading = this.app.chatModelsLoading;
     const sessionKey = this.app.chat.sessionKey;
     const defaultModel = "claude-sonnet-4-20250514";

     const { currentOverride, defaultLabel, options } = resolveChatModelSelectState(
        this.app.chatModelCatalog, this.app.chatModelOverrides, sessionKey, defaultModel
     );

     const disabled = !this.app.connected || busy || (loading && options.length === 0);

     return html`
        <select class="chat-model-select"
                style="font-size: 11px; padding: 3px 8px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--foreground); cursor: pointer;"
                ?disabled=${disabled}
                aria-label="Chat model"
                @change=${this.handleModelChange}>
           <option value="" ?selected=${currentOverride === ""}>${loading ? "Loading models..." : defaultLabel}</option>
           ${options.map(opt => html`
              <option value=${opt.value} ?selected=${opt.value === currentOverride}>${opt.label}</option>
           `)}
        </select>
     `;
  }

  // ─── Approval Modal ───────────────────────────────────────────

  private renderApprovalModal() {
     const entry = this.app.approvalQueue[0];
     if (!entry) return "";
     return html`
        <coreblow-tool-approval-modal
           .entry=${entry}
           .onDecision=${(id: string, decision: ApprovalDecision) => this.handleApprovalDecision(id, decision)}
        ></coreblow-tool-approval-modal>
     `;
  }

  // ─── Main Render ──────────────────────────────────────────────

  render() {
    const chat = this.app.chat;
    const busy = chat.isBusy;

    return html`
      ${this.renderApprovalModal()}

      <div class="chat-container" style="display: flex; flex-direction: column; height: 100%;">

         <!-- Header -->
         <div class="chat-header" style="padding: 12px var(--shell-pad); border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px;">
            <span style="font-weight: 600; flex: 1;">💬 Chat</span>
            ${this.renderModelSelect()}
            ${chat.sessionKey ? html`<span style="font-size: 11px; color: var(--muted);">${chat.sessionKey.slice(0, 12)}…</span>` : ""}
            <button class="btn btn-sm" style="font-size: 11px; padding: 4px 12px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground);"
             @click=${this.handleNewSession}>+ New</button>
         </div>

         <!-- Messages -->
         <div class="chat-history" style="flex: 1; overflow-y: auto; padding: var(--shell-pad); display: flex; flex-direction: column; gap: 16px;">
            ${chat.messages.length === 0 && !busy ? html`
               <div style="margin: auto; text-align: center; color: var(--muted); opacity: 0.6;">
                 <div style="font-size: 48px; margin-bottom: 16px;">🐙</div>
                 <div>Send a message to CoreBlow</div>
               </div>
            ` : ""}

            ${chat.messages.map(msg => this.renderMessage(msg))}
            ${this.renderStreamingState()}
         </div>

         <!-- Input -->
         <div class="chat-input-area" style="padding: var(--shell-pad); border-top: 1px solid var(--border);">
             <div class="chat-input-box" style="display: flex; gap: 8px; background: var(--bg-elevated); padding: 8px; border-radius: var(--radius-md); border: 1px solid var(--border);">
                <input class="chat-input"
                       style="flex: 1; background: transparent; border: none; color: var(--text); padding: 8px; outline: none; font-family: var(--font-sans);"
                       placeholder="${busy ? 'Waiting for response...' : 'Message CoreBlow...'}"
                       .value=${this.inputText}
                       ?disabled=${busy}
                       @input=${(e: Event) => this.inputText = (e.target as HTMLInputElement).value}
                       @keydown=${this.handleKeyDown}
                />
                ${busy
                   ? html`<button class="btn btn-abort" style="background: var(--destructive, #ef4444); color: white; border:none; padding: 8px 16px; border-radius: var(--radius-sm); cursor: pointer;"
                            @click=${this.handleAbort}>Stop</button>`
                   : html`<button class="btn" style="background: var(--accent); color: var(--primary-foreground); border:none; padding: 8px 16px; border-radius: var(--radius-sm); cursor: pointer;"
                            @click=${this.handleSend}>Send</button>`
                }
             </div>
         </div>
      </div>
    `;
  }
}
