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
  @state() showWorkspaceDrawer = false;
  @state() activeWorkspaceTab: "files" | "preview" = "files";
  @state() selectedArtifact: { name: string; content: string; language?: string } | null = null;
  @state() workspaceFiles: Array<{ name: string; type: "file" | "dir"; status?: string }> = [
    { name: "package.json", type: "file", status: "tracked" },
    { name: "src/cli/desktop-cli.ts", type: "file", status: "clean" },
    { name: "ui/src/ui/views/chat.ts", type: "file", status: "modified" },
    { name: "apps/desktop/src/components/StatusBar.tsx", type: "file", status: "clean" },
    { name: "scripts/check-release-sync.mjs", type: "file", status: "clean" },
  ];

  createRenderRoot() {
    return this; // light DOM
  }

  toggleWorkspaceDrawer = () => {
    this.showWorkspaceDrawer = !this.showWorkspaceDrawer;
    if (this.showWorkspaceDrawer && !this.selectedArtifact) {
      this.selectedArtifact = {
        name: "active-workspace.md",
        content: `# Workspace Active State\n- Target Cwd: ${this.projectCwd || "."}\n- Session: ${this.app.chat.sessionKey || "ephemeral"}\n- Profile: ${this.executionProfile}\n- Git Status: On branch main (WAL + FTS5 synced)`,
        language: "markdown",
      };
    }
  };

  selectFileForPreview(file: { name: string; content?: string }) {
    this.selectedArtifact = {
      name: file.name,
      content: file.content || `// Content for ${file.name}\n// Loaded from workspace: ${this.projectCwd || "."}`,
      language: file.name.endsWith(".json") ? "json" : file.name.endsWith(".ts") || file.name.endsWith(".tsx") ? "typescript" : "text",
    };
    this.activeWorkspaceTab = "preview";
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
      const bubble = btn.closest(".chat-bubble") || btn.closest(".chat-message")?.querySelector(".chat-bubble");
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

  // ─── Thinking Block Extraction ───────────────────────────────

  private extractThinking(content: string): { thinking: string | null; cleanContent: string } {
    if (!content) return { thinking: null, cleanContent: "" };
    const match = content.match(/<think>([\s\S]*?)<\/think>/i);
    if (match) {
      return {
        thinking: match[1].trim(),
        cleanContent: content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim(),
      };
    }
    // Handle streaming open think tag
    if (content.includes("<think>")) {
      const parts = content.split(/<think>/i);
      const after = parts[1] ?? "";
      if (!after.includes("</think>")) {
        return {
          thinking: after.trim(),
          cleanContent: parts[0]?.trim() ?? "",
        };
      }
    }
    return { thinking: null, cleanContent: content };
  }

  private renderThinkingBlock(thinking: string) {
    if (!thinking) return "";
    return html`
      <details class="thinking-block" style="margin-bottom: 8px; border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); background: var(--surface-flat-muted); overflow: hidden;">
        <summary style="padding: 6px 10px; font-size: 11px; font-weight: 500; color: var(--muted); cursor: pointer; display: flex; align-items: center; gap: 6px; user-select: none;">
          ${renderIcon("brain", "12px", "color: var(--muted);")}
          <span>Thought Process (${thinking.length} chars)</span>
        </summary>
        <div style="padding: 8px 12px; border-top: 1px solid var(--border-subtle); font-family: var(--mono); font-size: 11px; color: var(--muted-foreground); white-space: pre-wrap; max-height: 200px; overflow-y: auto;">
          ${thinking}
        </div>
      </details>
    `;
  }

  // ─── Tool Card ────────────────────────────────────────────────

  private renderToolCard(tool: ToolStreamEntry) {
    const isRunning = tool.phase === "start" || tool.phase === "update";
    const icon = isRunning
      ? renderIcon("loader", "14px")
      : renderIcon("check", "14px", "color: var(--ok, #22c55e);");
    const statusClass = isRunning ? "tool-card--running" : "tool-card--done";

    return html`
      <details class="tool-card ${statusClass}" style="margin: 4px 0; border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); background: var(--surface-flat-muted); overflow: hidden;" ?open=${isRunning}>
        <summary style="display: flex; align-items: center; gap: 8px; font-size: 11px; padding: 6px 10px; cursor: pointer; user-select: none;">
          <span class="tool-card-icon">${icon}</span>
          <span class="tool-card-name" style="font-weight: 500; font-family: var(--mono); color: var(--accent);">${tool.name}</span>
          ${tool.durationMs != null ? html`<span class="tool-card-duration" style="color: var(--muted); font-size: 10px; margin-left: auto;">${tool.durationMs}ms</span>` : ""}
        </summary>
        <div style="padding: 6px 10px; border-top: 1px solid var(--border-subtle); font-size: 10px;">
          ${tool.args ? html`
            <div style="margin-bottom: 4px;">
              <span style="color: var(--muted); font-weight: 600;">Arguments:</span>
              <pre style="margin: 2px 0; padding: 4px; background: rgba(0,0,0,0.2); border-radius: 3px; font-family: var(--mono); white-space: pre-wrap; max-height: 100px; overflow-y: auto;">${typeof tool.args === "string" ? tool.args : JSON.stringify(tool.args, null, 2)}</pre>
            </div>
          ` : ""}
          ${tool.output ? html`
            <div>
              <span style="color: var(--muted); font-weight: 600;">Output:</span>
              <pre style="margin: 2px 0; padding: 4px; background: rgba(0,0,0,0.2); border-radius: 3px; font-family: var(--mono); white-space: pre-wrap; max-height: 120px; overflow-y: auto;">${tool.output.length > 500 ? tool.output.slice(0, 500) + "…" : tool.output}</pre>
            </div>
          ` : ""}
        </div>
      </details>
    `;
  }

  // ─── Execution Steps Card ─────────────────────────────────────

  private renderExecutionSteps(steps?: string[], toolCalls?: ToolStreamEntry[]) {
    const totalCount = (steps?.length ?? 0) + (toolCalls?.length ?? 0);
    if (totalCount === 0) return "";

    return html`
      <details class="coreblow-steps-card" style="margin: 8px 0; border: 1px solid var(--border-hairline); border-radius: 6px; background: var(--surface-flat-muted); overflow: hidden;">
        <summary style="padding: 6px 10px; font-size: 11px; font-weight: 500; color: var(--accent); cursor: pointer; display: flex; align-items: center; gap: 6px; user-select: none;">
          ${renderIcon("check", "12px", "color: var(--accent);")}
          <span>CoreBlow Execution Steps (${totalCount})</span>
        </summary>
        <div style="padding: 8px 12px; border-top: 1px solid var(--border-subtle); font-family: var(--font-mono, monospace); font-size: 11px; color: var(--muted); display: flex; flex-direction: column; gap: 4px;">
          ${steps?.map((step) => html`<div style="display: flex; gap: 6px;"><span style="color: var(--ok, #22c55e);">✓</span><span>${step}</span></div>`)}
          ${toolCalls?.map((tc) => this.renderToolCard(tc))}
        </div>
      </details>
    `;
  }

  // ─── Message ──────────────────────────────────────────────────

  private renderMessage(msg: ChatMessage) {
    const isUser = msg.role === "user";
    const isSystem = msg.role === "system";
    const { thinking, cleanContent } = this.extractThinking(msg.content);

    if (isUser) {
      return html`
        <div class="chat-message chat-message--user" style="display: flex; justify-content: flex-end; margin: 14px 0;">
          <div
            class="chat-bubble"
            data-raw-content=${msg.content}
            style="position: relative; background: var(--bg-chip, rgba(22, 50, 44, 0.7)); border: 1px solid var(--border-medium, var(--border)); color: var(--foreground); padding: 10px 16px; border-radius: var(--radius-lg, 16px); max-width: 75%; font-size: 14px; line-height: 1.5; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2); word-break: break-word;"
          >
            ${unsafeHTML(renderMarkdown(cleanContent))}
          </div>
        </div>
      `;
    }

    const isError = Boolean(msg.error) || msg.content.startsWith("**Error**") || msg.content.toLowerCase().startsWith("error:");
    if (isSystem) {
      return html`
        <div class="chat-message chat-message--system" style="margin: 10px 0; color: ${isError ? "var(--danger, #f87171)" : "var(--muted)"}; font-size: 13px; line-height: 1.5; background: transparent; border: none; padding: 0;">
          ${unsafeHTML(renderMarkdown(cleanContent))}
        </div>
      `;
    }

    return html`
      <div class="chat-message chat-message--assistant" style="display: block; margin: 18px 0; width: 100%; min-width: 0; font-size: 14px; line-height: 1.65; color: var(--foreground); background: transparent; border: none; padding: 0;">
        ${this.renderExecutionSteps(msg.toolSteps, msg.toolCalls)}
        ${thinking ? this.renderThinkingBlock(thinking) : ""}
        <div class="chat-bubble" data-raw-content=${msg.content} style="position: relative; background: transparent; border: none; padding: 0; color: var(--foreground); max-width: 100%; word-break: break-word;">
          ${unsafeHTML(renderMarkdown(cleanContent))}
        </div>
        ${msg.error ? html`
          <div class="message-error" style="color: var(--danger, #f87171); font-size: 13px; line-height: 1.5; margin-top: ${cleanContent ? "8px" : "0"};">
            Error: ${msg.error}
          </div>
        ` : ""}
        ${!msg.streaming && cleanContent.trim().length > 0 ? html`
          <div style="margin-top: 8px; display: flex; align-items: center;">
            <button class="bubble-copy-btn" style="background: transparent; border: none; color: var(--muted); font-size: 11px; padding: 2px 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; border-radius: var(--radius-xs); transition: color 0.15s ease;">
              ${renderIcon("fileText", "12px", "color: currentColor;")}
              <span>Copy</span>
            </button>
          </div>
        ` : ""}
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

    const rawStream = chat.chatStream ?? "";
    const { thinking, cleanContent } = this.extractThinking(rawStream);

    return html`
      <div class="chat-message chat-message--assistant streaming-message" style="display: block; margin: 18px 0; width: 100%; min-width: 0; font-size: 14px; line-height: 1.65; color: var(--foreground); background: transparent; border: none; padding: 0;">
        ${this.renderExecutionSteps(undefined, activeTools)}
        ${thinking ? this.renderThinkingBlock(thinking) : ""}
        <div class="chat-bubble streaming-bubble" style="background: transparent; border: none; padding: 0; color: var(--foreground); max-width: 100%; word-break: break-word;">
          ${cleanContent ? unsafeHTML(renderMarkdown(cleanContent)) : (!thinking ? html`<span class="typing-dots"><span>·</span><span>·</span><span>·</span></span>` : "")}
          <span class="stream-cursor" style="color: var(--accent); margin-left: 2px;">▍</span>
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

  // ─── Context Ring Indicator ───────────────────────────────────

  renderContextRing() {
    const maxTokens = 200000;
    let usedTokens = 0;
    for (const m of this.app.chat.messages) {
      usedTokens += Math.ceil((m.content?.length || 0) / 3.8);
      if (m.toolSteps) {
        for (const s of m.toolSteps) usedTokens += Math.ceil(s.length / 3.8);
      }
    }
    if (this.app.chat.chatStream) {
      usedTokens += Math.ceil(this.app.chat.chatStream.length / 3.8);
    }
    const pct = Math.min(100, (usedTokens / maxTokens) * 100);
    const compactionThresholdPct = 78;
    const isNearCompaction = pct >= compactionThresholdPct;
    const isWarning = pct >= 50 && !isNearCompaction;
    const strokeColor = isNearCompaction
      ? "var(--accent, #ff5c5c)"
      : isWarning
        ? "var(--warn, #f59e0b)"
        : "var(--ok, #22c55e)";
    const dashArray = `${pct}, 100`;

    return html`
      <div
        class="context-ring"
        title="${usedTokens.toLocaleString()} / ${maxTokens.toLocaleString()} tokens (${pct.toFixed(1)}%) — Auto-compaction at 78%"
        style="display: flex; align-items: center; gap: 5px; cursor: help; user-select: none;"
      >
        <svg width="18" height="18" viewBox="0 0 36 36" style="transform: rotate(-90deg); flex-shrink: 0;">
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="var(--border-hairline, rgba(255,255,255,0.1))"
            stroke-width="3.5"
          />
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="${strokeColor}"
            stroke-width="3.5"
            stroke-dasharray="${dashArray}"
            stroke-linecap="round"
          />
        </svg>
        <span style="font-size: 10px; font-family: var(--mono); color: var(--muted);">${pct.toFixed(0)}%</span>
      </div>
    `;
  }

  // ─── Collapsible Workspace Drawer ─────────────────────────────

  private renderWorkspaceDrawer() {
    return html`
      <aside class="chat-workspace-drawer" style="width: 320px; border-left: 1px solid var(--border-hairline); background: var(--surface-flat, var(--bg-elevated)); display: flex; flex-direction: column; height: 100%; overflow: hidden; flex-shrink: 0;">
        <!-- Drawer Tabs Header -->
        <div style="padding: 10px 12px; border-bottom: 1px solid var(--border-hairline); display: flex; align-items: center; justify-content: space-between; font-size: 12px;">
          <div style="display: flex; gap: 8px;">
            <button
              class="workspace-tab-btn"
              style="background: transparent; border: none; font-size: 11px; font-weight: 600; cursor: pointer; padding: 4px 6px; border-radius: 4px; color: ${this.activeWorkspaceTab === 'files' ? 'var(--accent)' : 'var(--muted)'}; border-bottom: 2px solid ${this.activeWorkspaceTab === 'files' ? 'var(--accent)' : 'transparent'};"
              @click=${() => { this.activeWorkspaceTab = 'files'; }}
            >
              Files & Git
            </button>
            <button
              class="workspace-tab-btn"
              style="background: transparent; border: none; font-size: 11px; font-weight: 600; cursor: pointer; padding: 4px 6px; border-radius: 4px; color: ${this.activeWorkspaceTab === 'preview' ? 'var(--accent)' : 'var(--muted)'}; border-bottom: 2px solid ${this.activeWorkspaceTab === 'preview' ? 'var(--accent)' : 'transparent'};"
              @click=${() => { this.activeWorkspaceTab = 'preview'; }}
            >
              Preview ${this.selectedArtifact ? `(${this.selectedArtifact.name})` : ""}
            </button>
          </div>
          <button
            class="workspace-close-btn"
            style="background: transparent; border: none; color: var(--muted); cursor: pointer; font-size: 14px; padding: 2px 6px;"
            @click=${() => { this.showWorkspaceDrawer = false; }}
            title="Close workspace drawer"
          >×</button>
        </div>

        <!-- Drawer Content -->
        <div style="flex: 1; overflow-y: auto; padding: 12px;">
          ${this.activeWorkspaceTab === 'files' ? this.renderWorkspaceFiles() : this.renderWorkspacePreview()}
        </div>
      </aside>
    `;
  }

  private renderWorkspaceFiles() {
    return html`
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <!-- Git Status Summary -->
        <div class="surface-flat--subtle" style="padding: 8px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; font-weight: 600;">
            <span style="display: flex; align-items: center; gap: 6px;">
              ${renderIcon("folder", "12px", "color: var(--accent);")}
              <span>${this.projectCwd || "Workspace Root"}</span>
            </span>
            <span style="font-family: var(--mono); font-size: 10px; color: var(--ok, #22c55e); background: rgba(34, 197, 94, 0.1); padding: 1px 5px; border-radius: 3px;">git:main</span>
          </div>
          <div style="font-size: 10px; color: var(--muted); margin-top: 4px;">
            SQLite WAL session sync active
          </div>
        </div>

        <!-- File List -->
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <div style="font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 4px;">
            Active Files (${this.workspaceFiles.length})
          </div>
          ${this.workspaceFiles.map((file) => html`
            <div
              class="workspace-file-row"
              style="display: flex; align-items: center; justify-content: space-between; padding: 5px 8px; border-radius: var(--radius-sm); font-size: 11px; cursor: pointer; background: var(--surface-flat-muted); border: 1px solid var(--border-subtle); margin-bottom: 2px;"
              @click=${() => this.selectFileForPreview(file)}
            >
              <span style="display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${renderIcon(file.type === "dir" ? "folder" : "fileText", "12px", "color: var(--muted);")}
                <span style="font-family: var(--mono); font-size: 10px;">${file.name}</span>
              </span>
              <span style="font-size: 9px; padding: 1px 4px; border-radius: 2px; text-transform: lowercase; font-family: var(--mono); background: ${file.status === 'modified' ? 'rgba(245, 158, 11, 0.15)' : file.status === 'staged' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)'}; color: ${file.status === 'modified' ? 'var(--warn, #f59e0b)' : file.status === 'staged' ? 'var(--ok, #22c55e)' : 'var(--muted)'};">
                ${file.status ?? "clean"}
              </span>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  private renderWorkspacePreview() {
    if (!this.selectedArtifact) {
      return html`
        <div style="padding: 24px; text-align: center; color: var(--muted); font-size: 11px;">
          Select a file from the list or an artifact from chat to preview diffs and code.
        </div>
      `;
    }

    return html`
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 6px; border-bottom: 1px solid var(--border-hairline);">
          <span style="font-family: var(--mono); font-size: 11px; font-weight: 600;">${this.selectedArtifact.name}</span>
          <span style="font-size: 9px; padding: 1px 5px; border-radius: 3px; background: var(--bg-elevated); border: 1px solid var(--border-hairline); font-family: var(--mono); color: var(--muted);">${this.selectedArtifact.language ?? "plain"}</span>
        </div>
        <pre style="margin: 0; padding: 8px; background: var(--surface-flat-muted); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); font-family: var(--mono); font-size: 10px; line-height: 1.4; overflow-x: auto; white-space: pre-wrap; color: var(--foreground); max-height: 500px; overflow-y: auto;">${this.selectedArtifact.content}</pre>
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

      <div class="chat-workspace-wrapper" style="display: flex; flex: 1; height: 100%; width: 100%; overflow: hidden; position: relative;">
        <div class="chat-container" style="flex: 1; min-width: 0; position: relative; display: flex; flex-direction: column; height: 100%;">
          ${this.renderSessionsPopover()}

          <!-- Header -->
          <div class="chat-header" style="padding: 10px var(--shell-pad); border-bottom: 1px solid var(--border-hairline); display: flex; align-items: center; gap: 10px;">
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
                style="width: 100%; height: 26px; padding: 2px 24px 2px 8px; font-size: 11px; background: var(--bg-elevated); border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); color: var(--foreground); outline: none;"
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
              style="font-size: 11px; padding: 4px 8px; background: var(--bg-elevated); border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); display: flex; align-items: center; gap: 4px;"
              @click=${() => { this.showSessionList = !this.showSessionList; }}
              title="Chat Sessions"
            >
              <span>${chat.sessionKey ? chat.sessionKey.slice(0, 8) + "…" : "Sessions"}</span>
              <span style="font-size: 9px;">▼</span>
            </button>

            <!-- New Session -->
            <button
              class="btn btn-sm"
              style="font-size: 11px; padding: 4px 10px; background: var(--bg-elevated); border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); display: flex; align-items: center; gap: 6px;"
              @click=${this.handleNewSession}
            >
              ${renderIcon("plus", "12px")}
              <span>${t("chat.newShort")}</span>
            </button>

            <!-- Toggle Workspace Drawer -->
            <button
              class="btn btn-sm workspace-drawer-toggle"
              style="font-size: 11px; padding: 4px 8px; background: ${this.showWorkspaceDrawer ? 'var(--accent-subtle)' : 'var(--bg-elevated)'}; border: 1px solid ${this.showWorkspaceDrawer ? 'var(--accent)' : 'var(--border-hairline)'}; border-radius: var(--radius-sm); cursor: pointer; color: ${this.showWorkspaceDrawer ? 'var(--accent)' : 'var(--foreground)'}; display: flex; align-items: center; gap: 4px;"
              @click=${this.toggleWorkspaceDrawer}
              title="Toggle Workspace & Preview Drawer"
            >
              ${renderIcon("folder", "12px")}
              <span>Workspace</span>
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
          <div class="chat-input-area" style="padding: 10px var(--shell-pad); border-top: 1px solid var(--border-hairline); display: flex; flex-direction: column; gap: 8px;">
            <!-- Quiet Instrument Tool Toolbar: Permission Profile & Workspace Cwd & Context Ring -->
            <div style="display: flex; align-items: center; gap: 8px; font-size: 11px;">
              <span style="color: var(--muted); font-size: 10px;">Permission:</span>
              <select
                style="font-size: 10px; padding: 2px 6px; background: var(--bg-elevated); border: 1px solid var(--border-hairline); border-radius: 4px; color: #10b981; cursor: pointer;"
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
                style="flex: 1; max-width: 260px; height: 22px; font-size: 10px; background: var(--bg-elevated); border: 1px solid var(--border-hairline); border-radius: 4px; color: var(--foreground); padding: 2px 6px; outline: none; font-family: var(--font-mono, monospace);"
              />

              <div style="margin-left: auto; display: flex; align-items: center;">
                ${this.renderContextRing()}
              </div>
            </div>

            <!-- Input Box -->
            <div class="chat-input-box" style="display: flex; gap: 8px; background: var(--bg-elevated); padding: 8px; border-radius: var(--radius-md); border: 1px solid var(--border-hairline);">
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

        <!-- Right Collapsible Workspace Drawer -->
        ${this.showWorkspaceDrawer ? this.renderWorkspaceDrawer() : ""}
      </div>
    `;
  }
}
