import { LitElement, html } from "lit";
import { customElement, property, state, query } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { t } from "../../i18n/index.ts";
import type { CoreBlowApp } from "../app.ts";
import { renderIcon } from "../icons.ts";
import { renderMarkdown } from "../markdown.ts";
import type { ChatMessage, ExecutionProfile, ToolStreamEntry } from "../app-chat.ts";
import { resolveChatModelSelectState, switchChatModel } from "../chat-model-select.ts";
import type { ApprovalDecision } from "./tool-approval-modal.ts";
import "./tool-approval-modal.ts";

@customElement("coreblow-chat-view")
export class ChatView extends LitElement {
  @property({ attribute: false }) app!: CoreBlowApp;
  @query(".chat-history") historyEl!: HTMLElement;

  @state() inputText = "";
  @state() private searchQuery = "";
  @state() private executionProfile: ExecutionProfile = "Workspace";
  @state() private projectCwd = "";
  @state() private showSessionList = false;

  createRenderRoot() {
    return this; // light DOM
  }

  private handleSend() {
    const text = this.inputText.trim();
    if (!text) return;
    this.inputText = "";
    this.app.chat.send(text, {
      executionProfile: this.executionProfile,
      cwd: this.projectCwd.trim() || undefined,
    });
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
    this.showSessionList = false;
  }

  private async handleModelChange(e: Event) {
    const next = (e.target as HTMLSelectElement).value.trim();
    const client = this.app.gateway.getClient();
    if (!client?.connected || !this.app.chat.sessionKey) return;
    this.app.chatModelOverrides = await switchChatModel(
      client,
      this.app.chat.sessionKey,
      next,
      this.app.chatModelOverrides,
    );
  }

  private handleApprovalDecision(id: string, decision: ApprovalDecision) {
    this.app.approvalQueue = this.app.approvalQueue.filter((e) => e.id !== id);
    const client = this.app.gateway.getClient();
    if (client?.connected) {
      client.request("tools.approve", { id, decision }).catch(() => {});
    }
  }

  private handleHistoryClick(e: MouseEvent) {
    const btn = (e.target as HTMLElement).closest(".code-copy-btn, .bubble-copy-btn") as HTMLElement | null;
    if (!btn) return;
    e.stopPropagation();

    if (btn.classList.contains("code-copy-btn")) {
      const block = btn.closest(".code-block");
      const codeEl = block?.querySelector("pre code");
      if (codeEl) {
        navigator.clipboard.writeText(codeEl.textContent || "");
        btn.textContent = "Copied!";
        setTimeout(() => {
          btn.textContent = "Copy";
        }, 1800);
      }
    } else if (btn.classList.contains("bubble-copy-btn")) {
      const bubble = btn.closest(".chat-bubble");
      const rawContent = bubble?.getAttribute("data-raw-content") || "";
      if (rawContent) {
        navigator.clipboard.writeText(rawContent);
        btn.textContent = "Copied!";
        setTimeout(() => {
          btn.textContent = "Copy";
        }, 1800);
      }
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
    const icon = isRunning
      ? renderIcon("loader", "14px")
      : renderIcon("check", "14px", "color: var(--ok, #22c55e);");
    const statusClass = isRunning ? "tool-card--running" : "tool-card--done";

    return html`
      <div class="tool-card ${statusClass}" style="margin: 4px 0; border: 1px solid #16322C; border-radius: 4px; padding: 6px 10px; background: #0A1815;">
        <div class="tool-card-header" style="display: flex; align-items: center; gap: 8px; font-size: 11px;">
          <span class="tool-card-icon">${icon}</span>
          <span class="tool-card-name" style="font-weight: 500; color: #10b981;">${tool.name}</span>
          ${tool.durationMs != null ? html`<span class="tool-card-duration" style="color: var(--muted); font-size: 10px;">${tool.durationMs}ms</span>` : ""}
        </div>
        ${tool.args ? html`
          <details class="tool-card-args" style="margin-top: 4px; font-size: 10px;">
            <summary style="cursor: pointer; color: var(--muted);">${t("chat.arguments")}</summary>
            <pre style="margin: 2px 0; padding: 4px; background: rgba(0,0,0,0.3); border-radius: 3px; font-family: monospace;">${typeof tool.args === "string" ? tool.args : JSON.stringify(tool.args, null, 2)}</pre>
          </details>
        ` : ""}
        ${tool.output ? html`
          <div class="tool-card-output" style="margin-top: 4px; font-size: 10px;">
            <pre style="margin: 2px 0; padding: 4px; background: rgba(0,0,0,0.3); border-radius: 3px; font-family: monospace; max-height: 120px; overflow-y: auto;">${tool.output.length > 500 ? tool.output.slice(0, 500) + "…" : tool.output}</pre>
          </div>
        ` : ""}
      </div>
    `;
  }

  // ─── Execution Steps Card ─────────────────────────────────────

  private renderExecutionSteps(steps?: string[], toolCalls?: ToolStreamEntry[]) {
    const totalCount = (steps?.length ?? 0) + (toolCalls?.length ?? 0);
    if (totalCount === 0) return "";

    return html`
      <details class="coreblow-steps-card" style="margin: 8px 0; border: 1px solid #16322C; border-radius: 6px; background: #0A1815; overflow: hidden;">
        <summary style="padding: 6px 10px; font-size: 11px; font-weight: 500; color: #10b981; cursor: pointer; display: flex; align-items: center; gap: 6px; user-select: none;">
          ${renderIcon("check", "12px", "color: #10b981;")}
          <span>CoreBlow Execution Steps (${totalCount})</span>
        </summary>
        <div style="padding: 8px 12px; border-top: 1px solid #16322C; font-family: var(--font-mono, monospace); font-size: 11px; color: #94a3b8; display: flex; flex-direction: column; gap: 4px;">
          ${steps?.map((step) => html`<div style="display: flex; gap: 6px;"><span style="color: #10b981;">✓</span><span>${step}</span></div>`)}
          ${toolCalls?.map((tc) => this.renderToolCard(tc))}
        </div>
      </details>
    `;
  }

  // ─── Message ──────────────────────────────────────────────────

  private renderMessage(msg: ChatMessage) {
    const isUser = msg.role === "user";
    const isSystem = msg.role === "system";

    return html`
      <div class="chat-message chat-message--${msg.role}" style="display: flex; gap: 12px; ${isUser ? "flex-direction: row-reverse" : ""}">
        <div class="chat-avatar" style="width: 32px; height: 32px; border-radius: 50%; background: ${isUser ? "var(--accent)" : isSystem ? "rgba(245, 158, 11, 0.15)" : "var(--bg-elevated)"}; color: ${isUser ? "var(--primary-foreground)" : isSystem ? "var(--warn, #f59e0b)" : "var(--accent)"}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
          ${isUser ? renderIcon("user", "16px") : isSystem ? renderIcon("alertTriangle", "16px") : renderIcon("coreblow", "16px")}
        </div>
        <div class="chat-bubble" data-raw-content=${msg.content} style="position: relative; background: ${isUser ? "var(--accent)" : "var(--bg-elevated)"}; color: ${isUser ? "var(--primary-foreground)" : "var(--foreground)"}; padding: 12px 16px; border-radius: var(--radius-md); max-width: 80%;">
          ${!isUser && !isSystem ? html`
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 10px; color: var(--muted);">
              <span>CoreBlow Agent</span>
              <button class="bubble-copy-btn" style="background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 3px; color: inherit; font-size: 10px; padding: 1px 6px; cursor: pointer;">Copy</button>
            </div>
          ` : ""}
          ${unsafeHTML(renderMarkdown(msg.content))}
          ${this.renderExecutionSteps(msg.toolSteps, msg.toolCalls)}
        </div>
      </div>
    `;
  }

  // ─── Streaming Indicator ──────────────────────────────────────

  private renderStreamingState() {
    const chat = this.app.chat;
    if (!chat.chatRunId && !chat.chatSending) return "";

    const activeTools = chat.toolStreamOrder
      .map((id) => chat.toolStream.get(id))
      .filter((e): e is ToolStreamEntry => Boolean(e));

    return html`
      <div class="chat-message chat-message--assistant" style="display: flex; gap: 12px;">
        <div class="chat-avatar" style="width: 32px; height: 32px; border-radius: 50%; background: var(--bg-elevated); color: var(--accent); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
          ${renderIcon("coreblow", "16px")}
        </div>
        <div class="chat-bubble streaming-bubble" style="background: var(--bg-elevated); padding: 12px 16px; border-radius: var(--radius-md); max-width: 80%;">
          ${chat.chatStream ? unsafeHTML(renderMarkdown(chat.chatStream)) : html`<span class="typing-dots"><span>·</span><span>·</span><span>·</span></span>`}
          ${this.renderExecutionSteps(undefined, activeTools)}
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
      this.app.chatModelCatalog,
      this.app.chatModelOverrides,
      sessionKey,
      defaultModel,
    );

    const disabled = !this.app.connected || busy || (loading && options.length === 0);

    return html`
      <select class="chat-model-select"
              style="font-size: 11px; padding: 3px 8px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--foreground); cursor: pointer;"
              ?disabled=${disabled}
              aria-label=${t("chat.selectModel")}
              @change=${this.handleModelChange}>
        <option value="" ?selected=${currentOverride === ""}>${loading ? t("chat.loadingModels") : defaultLabel}</option>
        ${options.map((opt) => html`
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

  // ─── Sessions Drawer / Popover ────────────────────────────────

  private renderSessionsPopover() {
    if (!this.showSessionList) return "";
    const sessions = this.app.chat.recentSessions;

    return html`
      <div class="chat-sessions-popover" style="position: absolute; top: 48px; right: 12px; width: 280px; max-height: 320px; overflow-y: auto; background: var(--bg-elevated, #0A1815); border: 1px solid var(--border, #16322C); border-radius: var(--radius-md); box-shadow: 0 10px 25px rgba(0,0,0,0.5); z-index: 100; padding: 8px;">
        <div style="font-size: 11px; font-weight: 600; padding: 4px 8px; border-bottom: 1px solid var(--border); margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
          <span>Recent Sessions (${sessions.length})</span>
          <button style="background: transparent; border: none; color: var(--muted); cursor: pointer;" @click=${() => { this.showSessionList = false; }}>×</button>
        </div>
        ${sessions.length === 0 ? html`<div style="font-size: 11px; color: var(--muted); padding: 8px; text-align: center;">No saved sessions</div>` : ""}
        ${sessions.map((s) => {
          const isActive = s.id === this.app.chat.sessionKey;
          return html`
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; border-radius: 4px; font-size: 11px; background: ${isActive ? "rgba(16, 185, 129, 0.15)" : "transparent"}; color: ${isActive ? "#10b981" : "var(--foreground)"}; margin-bottom: 2px;">
              <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;" @click=${() => { this.app.chat.selectSession(s.id); this.showSessionList = false; }}>
                ${s.title}
              </span>
              <button title="Delete session" style="background: transparent; border: none; color: var(--muted); cursor: pointer; padding: 0 4px; font-size: 12px;" @click=${(e: MouseEvent) => { e.stopPropagation(); this.app.chat.deleteSession(s.id); }}>×</button>
            </div>
          `;
        })}
      </div>
    `;
  }

  // ─── Main Render ──────────────────────────────────────────────

  render() {
    const chat = this.app.chat;
    const busy = chat.isBusy;
    const q = this.searchQuery.trim().toLowerCase();
    const visibleMessages = q
      ? chat.messages.filter((m) => m.content.toLowerCase().includes(q))
      : chat.messages;

    return html`
      ${this.renderApprovalModal()}

      <div class="chat-container" style="position: relative; display: flex; flex-direction: column; height: 100%;">
        ${this.renderSessionsPopover()}

        <!-- Header -->
        <div class="chat-header" style="padding: 10px var(--shell-pad); border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px;">
          <span style="font-weight: 600; display: flex; align-items: center; gap: 8px;">
            ${renderIcon("messageSquare", "16px", "color: var(--accent);")}
            <span>${t("tabs.chat")}</span>
          </span>

          <!-- Search Chats Filter -->
          <div style="position: relative; flex: 1; max-width: 240px;">
            <input
              type="text"
              placeholder="Search chats..."
              .value=${this.searchQuery}
              @input=${(e: Event) => { this.searchQuery = (e.target as HTMLInputElement).value; }}
              style="width: 100%; height: 26px; padding: 2px 24px 2px 8px; font-size: 11px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--foreground); outline: none;"
            />
            ${this.searchQuery ? html`
              <button
                @click=${() => { this.searchQuery = ""; }}
                style="position: absolute; right: 4px; top: 3px; background: transparent; border: none; color: var(--muted); cursor: pointer; font-size: 12px;"
              >×</button>
            ` : ""}
          </div>

          <div style="flex: 1;"></div>

          ${this.renderModelSelect()}

          <!-- Sessions Dropdown Toggle -->
          <button
            class="btn btn-sm"
            style="font-size: 11px; padding: 4px 8px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); display: flex; align-items: center; gap: 4px;"
            @click=${() => { this.showSessionList = !this.showSessionList; }}
            title="Chat Sessions"
          >
            <span>${chat.sessionKey ? chat.sessionKey.slice(0, 8) + "…" : "Sessions"}</span>
            <span style="font-size: 9px;">▼</span>
          </button>

          <!-- New Session -->
          <button
            class="btn btn-sm"
            style="font-size: 11px; padding: 4px 10px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); display: flex; align-items: center; gap: 6px;"
            @click=${this.handleNewSession}
          >
            ${renderIcon("plus", "12px")}
            <span>${t("chat.newShort")}</span>
          </button>
        </div>

        <!-- Messages -->
        <div
          class="chat-history"
          @click=${this.handleHistoryClick}
          style="flex: 1; overflow-y: auto; padding: var(--shell-pad); display: flex; flex-direction: column; gap: 16px;"
        >
          ${visibleMessages.length === 0 && !busy ? html`
            <div style="margin: auto; text-align: center; color: var(--muted); opacity: 0.6;">
              <div style="display: flex; justify-content: center; margin-bottom: 16px; color: var(--accent);">
                ${renderIcon("coreblow", "48px")}
              </div>
              <div>${this.searchQuery ? `No messages matching "${this.searchQuery}"` : t("chat.empty")}</div>
            </div>
          ` : ""}

          ${visibleMessages.map((msg) => this.renderMessage(msg))}
          ${this.renderStreamingState()}
        </div>

        <!-- Input & Composer Controls -->
        <div class="chat-input-area" style="padding: 10px var(--shell-pad); border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px;">
          <!-- Quiet Instrument Tool Toolbar: Permission Profile & Workspace Cwd -->
          <div style="display: flex; align-items: center; gap: 8px; font-size: 11px;">
            <span style="color: var(--muted); font-size: 10px;">Permission:</span>
            <select
              style="font-size: 10px; padding: 2px 6px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 4px; color: #10b981; cursor: pointer;"
              .value=${this.executionProfile}
              @change=${(e: Event) => { this.executionProfile = (e.target as HTMLSelectElement).value as ExecutionProfile; }}
            >
              <option value="Workspace">Workspace (Contained)</option>
              <option value="Full access">Full access (Host-wide)</option>
              <option value="Guarded">Guarded (Safe inspection)</option>
              <option value="Read-only">Read-only (No mutations)</option>
            </select>

            <span style="color: var(--muted); font-size: 10px; margin-left: 4px;">Cwd:</span>
            <input
              type="text"
              placeholder="Workspace dir (/path/to/project)"
              .value=${this.projectCwd}
              @input=${(e: Event) => { this.projectCwd = (e.target as HTMLInputElement).value; }}
              style="flex: 1; max-width: 280px; height: 22px; font-size: 10px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 4px; color: var(--foreground); padding: 2px 6px; outline: none; font-family: var(--font-mono, monospace);"
            />
          </div>

          <!-- Input Box -->
          <div class="chat-input-box" style="display: flex; gap: 8px; background: var(--bg-elevated); padding: 8px; border-radius: var(--radius-md); border: 1px solid var(--border);">
            <input
              class="chat-input"
              style="flex: 1; background: transparent; border: none; color: var(--text); padding: 8px; outline: none; font-family: var(--font-sans);"
              placeholder=${busy ? t("chat.waiting") : t("chat.messagePlaceholder")}
              .value=${this.inputText}
              ?disabled=${busy}
              @input=${(e: Event) => { this.inputText = (e.target as HTMLInputElement).value; }}
              @keydown=${this.handleKeyDown}
            />
            ${busy ? html`
              <button
                class="btn btn-abort"
                style="background: var(--destructive, #ef4444); color: white; border:none; padding: 8px 16px; border-radius: var(--radius-sm); cursor: pointer; display: flex; align-items: center; gap: 4px; font-weight: 500;"
                @click=${this.handleAbort}
              >
                <span>■</span>
                <span>${t("chat.stop")}</span>
              </button>
            ` : html`
              <button
                class="btn"
                style="background: var(--accent); color: var(--primary-foreground); border:none; padding: 8px 16px; border-radius: var(--radius-sm); cursor: pointer; font-weight: 500;"
                @click=${this.handleSend}
              >
                ${t("common.send")}
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  }
}
