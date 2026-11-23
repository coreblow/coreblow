import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { t } from "../../i18n/index.ts";
import type { CoreBlowApp } from "../app.ts";
import { renderIcon } from "../icons.ts";

type SessionRow = {
   key: string;
   model: string;
   modelProvider: string;
   state: string;
   turnCount: number;
   totalTokens: number;
   createdAt: number;
   updatedAt: number;
   messageCount: number;
};

@customElement("coreblow-sessions-view")
export class SessionsView extends LitElement {
  @property({ attribute: false }) app!: CoreBlowApp;
  @state() sessions: SessionRow[] = [];
  @state() loading = false;
  @state() searchQuery = "";
  @state() sortColumn: "key" | "updated" | "tokens" = "updated";
  @state() sortDir: "asc" | "desc" = "desc";
  @state() selectedKeys = new Set<string>();
  @state() confirmDelete: string | null = null;
  @state() copiedKey: string | null = null;

  createRenderRoot() { return this; }

  connectedCallback() {
      super.connectedCallback();
      this.loadSessions();
  }

  private parseKeyMeta(key: string): { channel: string; isPeerScoped: boolean } {
    const parts = key.split(":");
    const known = ["telegram", "whatsapp", "discord", "slack", "signal", "msteams", "matrix", "zalo", "web", "imessage", "nostr", "feishu"];
    let channel = "local";
    let isPeerScoped = false;

    if (parts.length >= 4 && parts[0] === "agent") {
      const chCandidate = parts[2]?.toLowerCase();
      if (known.includes(chCandidate)) {
        channel = chCandidate;
        if (parts[3] === "direct") {
          isPeerScoped = true;
        }
      }
    } else {
      for (const c of known) {
        if (key.toLowerCase().includes(c)) {
          channel = c;
          if (key.includes("direct")) {
            isPeerScoped = true;
          }
          break;
        }
      }
    }

    return { channel, isPeerScoped };
  }

  private async copyDesktopHandoff(key: string) {
    const cmd = `coreblow desktop --session ${key}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(cmd);
      }
      this.copiedKey = key;
      setTimeout(() => {
        if (this.copiedKey === key) this.copiedKey = null;
      }, 1500);
    } catch (e) {
      console.warn("Failed to copy desktop handoff command:", e);
    }
  }

  private async loadSessions() {
      const client = this.app.gateway.getClient();
      if (!client?.connected) return;
      this.loading = true;
      try {
         const res = await client.request<{ sessions: SessionRow[] }>("sessions.list", {});
         this.sessions = res?.sessions ?? [];
      } catch { this.sessions = []; }
      this.loading = false;
  }

  private async deleteSession(key: string) {
      const client = this.app.gateway.getClient();
      if (!client?.connected) return;
      await client.request("sessions.delete", { key }).catch(() => {});
      this.confirmDelete = null;
      this.loadSessions();
  }

  private async resetSession(key: string) {
      const client = this.app.gateway.getClient();
      if (!client?.connected) return;
      await client.request("sessions.reset", { key }).catch(() => {});
      this.loadSessions();
  }

  private switchToSession(key: string) {
      this.app.chat.sessionKey = key;
      this.app.applySettings({ ...this.app.settings, sessionKey: key });
      this.app.setTab("chat" as any);
  }

  private async createNewSession() {
      const client = this.app.gateway.getClient();
      if (!client?.connected) return;
      const res = await client.request<{ id: string }>("sessions.create", {}).catch(() => null);
      if (res?.id) {
         this.switchToSession(res.id);
      }
      this.loadSessions();
  }

  private async deleteSelected() {
      const client = this.app.gateway.getClient();
      if (!client?.connected) return;
      for (const key of this.selectedKeys) {
          await client.request("sessions.delete", { key }).catch(() => {});
      }
      this.selectedKeys = new Set();
      this.loadSessions();
  }

  private get filteredSessions(): SessionRow[] {
      let rows = this.sessions;
      if (this.searchQuery) {
          const q = this.searchQuery.toLowerCase();
          rows = rows.filter(s => s.key.toLowerCase().includes(q) || s.model.toLowerCase().includes(q));
      }
      rows.sort((a, b) => {
          const mult = this.sortDir === "asc" ? 1 : -1;
          if (this.sortColumn === "key") return mult * a.key.localeCompare(b.key);
          if (this.sortColumn === "tokens") return mult * (a.totalTokens - b.totalTokens);
          return mult * (a.updatedAt - b.updatedAt);
      });
      return rows;
  }

  private toggleSort(col: "key" | "updated" | "tokens") {
      if (this.sortColumn === col) this.sortDir = this.sortDir === "asc" ? "desc" : "asc";
      else { this.sortColumn = col; this.sortDir = "desc"; }
  }

  private formatTime(ts: number): string {
      if (!ts) return "—";
      const d = new Date(ts);
      const now = Date.now();
      const diff = now - ts;
      if (diff < 60_000) return t("sessions.justNow");
      if (diff < 3_600_000) return t("sessions.minutesAgo", { count: String(Math.round(diff / 60_000)) });
      if (diff < 86_400_000) return t("sessions.hoursAgo", { count: String(Math.round(diff / 3_600_000)) });
      return d.toLocaleDateString();
  }

  private formatTokens(n: number): string {
      if (n === 0) return "0";
      if (n < 1000) return String(n);
      return `${(n / 1000).toFixed(1)}K`;
  }

  private renderSortIcon(col: string) {
      if (this.sortColumn !== col) return "";
      return this.sortDir === "asc" ? " ↑" : " ↓";
  }

  render() {
    const rows = this.filteredSessions;
    const activeKey = this.app.chat.sessionKey;
    const hasSelected = this.selectedKeys.size > 0;

    return html`
      <div style="display: flex; flex-direction: column; gap: 16px;">

        <!-- Header -->
        <div class="card">
           <div style="display: flex; align-items: center; gap: 12px;">
              <div style="flex: 1;">
                 <div class="card-title" style="display: flex; align-items: center; gap: 8px;">
                    <span>${t("sessions.title")}</span>
                    <span style="font-size: 11px; padding: 2px 8px; border-radius: 12px; background: rgba(34,197,94,0.12); color: var(--ok, #22c55e); font-family: var(--mono); font-weight: 600;">SQLite WAL + FTS5</span>
                 </div>
                 <div class="card-sub">${t("sessions.managedByAgentEngine", { count: String(this.sessions.length) })} · SQLite WAL + FTS5 Session Store</div>
              </div>
              <button class="btn" style="background: var(--accent); color: var(--primary-foreground); border:none; padding: 8px 16px; border-radius: var(--radius-sm); cursor: pointer; font-weight: 600;"
               @click=${this.createNewSession}>+ ${t("sessions.newSession")}</button>
              <button class="btn" style="background: var(--bg-elevated); border: 1px solid var(--border-hairline); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground);"
               @click=${() => this.loadSessions()}>↻ ${t("common.refresh")}</button>
           </div>

           <!-- Search + Bulk Actions -->
           <div style="margin-top: 16px; display: flex; gap: 12px; align-items: center;">
              <input style="flex: 1; background: var(--bg-elevated); border: 1px solid var(--border-hairline); padding: 8px 12px; border-radius: var(--radius-sm); color: var(--foreground); font-family: var(--font-sans);"
                     placeholder=${t("sessions.searchPlaceholder")}
                     .value=${this.searchQuery}
                     @input=${(e: Event) => this.searchQuery = (e.target as HTMLInputElement).value} />
              ${hasSelected ? html`
                 <button class="btn" style="background: var(--destructive, #ef4444); color: white; border: none; padding: 8px 16px; border-radius: var(--radius-sm); cursor: pointer; font-size: 12px;"
                  @click=${this.deleteSelected}>${t("sessions.deleteSelected", { count: String(this.selectedKeys.size) })}</button>
              ` : ""}
           </div>
        </div>

        ${this.loading ? html`<div style="text-align: center; color: var(--muted); padding: 40px;">${t("sessions.loading")}</div>` : ""}

        ${!this.loading && rows.length === 0 ? html`
           <div class="card" style="text-align: center; padding: 40px;">
              <div style="margin-bottom: 12px;">${renderIcon("coreblow", "44px", "color: var(--muted); opacity: 0.4;")}</div>
              <div style="color: var(--muted);">${t("sessions.emptyTitle")}</div>
              <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">${t("sessions.emptySubtitle")}</div>
           </div>
        ` : ""}

        ${rows.length > 0 ? html`
           <!-- Table -->
           <div class="card" style="padding: 0; overflow: hidden;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                 <thead>
                    <tr style="background: var(--bg-elevated); border-bottom: 1px solid var(--border);">
                       <th style="padding: 10px 12px; text-align: left; width: 32px;">
                          <input type="checkbox"
                                 @change=${(e: Event) => {
                                    const checked = (e.target as HTMLInputElement).checked;
                                    this.selectedKeys = checked ? new Set(rows.map(r => r.key)) : new Set();
                                 }} />
                       </th>
                       <th style="padding: 10px 12px; text-align: left; cursor: pointer; user-select: none; color: var(--muted);"
                           @click=${() => this.toggleSort("key")}>${t("sessions.columnSession")}${this.renderSortIcon("key")}</th>
                       <th style="padding: 10px 12px; text-align: left; color: var(--muted);">${t("sessions.columnModel")}</th>
                       <th style="padding: 10px 12px; text-align: center; color: var(--muted);">${t("sessions.columnTurns")}</th>
                       <th style="padding: 10px 12px; text-align: right; cursor: pointer; user-select: none; color: var(--muted);"
                           @click=${() => this.toggleSort("tokens")}>${t("sessions.columnTokens")}${this.renderSortIcon("tokens")}</th>
                       <th style="padding: 10px 12px; text-align: right; cursor: pointer; user-select: none; color: var(--muted);"
                           @click=${() => this.toggleSort("updated")}>${t("sessions.columnUpdated")}${this.renderSortIcon("updated")}</th>
                       <th style="padding: 10px 12px; text-align: center; color: var(--muted);">${t("common.actions")}</th>
                    </tr>
                 </thead>
                 <tbody>
                    ${rows.map(s => {
                       const isActive = s.key === activeKey;
                       const isSelected = this.selectedKeys.has(s.key);
                       const meta = this.parseKeyMeta(s.key);
                       return html`
                          <tr style="border-bottom: 1px solid var(--border); ${isActive ? 'background: rgba(99,102,241,0.08);' : ''} transition: background 0.15s ease;"
                              @mouseenter=${(e: Event) => (e.currentTarget as HTMLElement).style.background = isActive ? 'rgba(99,102,241,0.12)' : 'var(--bg-elevated)'}
                              @mouseleave=${(e: Event) => (e.currentTarget as HTMLElement).style.background = isActive ? 'rgba(99,102,241,0.08)' : ''}>
                             <td style="padding: 10px 12px;">
                                <input type="checkbox" .checked=${isSelected}
                                       @change=${() => {
                                          const next = new Set(this.selectedKeys);
                                          if (isSelected) { next.delete(s.key); } else { next.add(s.key); }
                                          this.selectedKeys = next;
                                       }} />
                             </td>
                             <td style="padding: 10px 12px;">
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                   <div style="display: flex; align-items: center; gap: 8px;">
                                      ${isActive ? html`<span style="width: 8px; height: 8px; border-radius: 50%; background: var(--accent, #6366f1); flex-shrink: 0;"></span>` : ""}
                                      <span style="font-family: var(--mono); font-size: 12px; ${isActive ? 'color: var(--accent); font-weight: 600;' : ''}">${s.key.length > 24 ? s.key.slice(0, 24) + "…" : s.key}</span>
                                   </div>
                                   <div style="display: flex; align-items: center; gap: 6px;">
                                      <span style="font-size: 10px; padding: 1px 6px; border-radius: var(--radius-sm); background: var(--bg-elevated); border: 1px solid var(--border); font-family: var(--mono); text-transform: uppercase; color: var(--foreground);">
                                         ${meta.channel}
                                      </span>
                                      ${meta.isPeerScoped ? html`
                                         <span style="font-size: 10px; padding: 1px 6px; border-radius: var(--radius-sm); background: rgba(99,102,241,0.12); color: var(--accent); font-family: var(--mono);" title="dmScope: per-channel-peer">
                                            per-channel-peer
                                         </span>
                                      ` : ""}
                                   </div>
                                </div>
                             </td>
                             <td style="padding: 10px 12px;">
                                <span style="font-size: 11px; padding: 2px 8px; background: var(--bg-elevated); border-radius: 12px; color: var(--muted);">${s.model || t("chat.defaultModel")}</span>
                             </td>
                             <td style="padding: 10px 12px; text-align: center;">${s.turnCount}</td>
                             <td style="padding: 10px 12px; text-align: right; font-family: var(--mono); font-size: 12px;">${this.formatTokens(s.totalTokens)}</td>
                             <td style="padding: 10px 12px; text-align: right; font-size: 12px; color: var(--muted);">${this.formatTime(s.updatedAt)}</td>
                             <td style="padding: 10px 12px; text-align: center;">
                                <div style="display: flex; gap: 4px; justify-content: center; align-items: center;">
                                   <button style="background: ${this.copiedKey === s.key ? 'rgba(34,197,94,0.15)' : 'none'}; border: 1px solid ${this.copiedKey === s.key ? 'var(--ok, #22c55e)' : 'var(--border)'}; border-radius: var(--radius-sm); padding: 4px 8px; cursor: pointer; font-size: 11px; color: ${this.copiedKey === s.key ? 'var(--ok, #22c55e)' : 'var(--foreground)'}; display: inline-flex; align-items: center; gap: 4px;"
                                    @click=${() => void this.copyDesktopHandoff(s.key)}
                                    title="Copy desktop handoff: coreblow desktop --session ${s.key}"
                                    aria-label="Copy desktop handoff">
                                      ${this.copiedKey === s.key ? html`<span>✓ Copied</span>` : html`${renderIcon("monitor", "12px")} <span style="font-size: 10px;">Handoff</span>`}
                                   </button>
                                   <button style="background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 4px 8px; cursor: pointer; font-size: 11px; color: var(--foreground); display: inline-flex; align-items: center;"
                                    @click=${() => this.switchToSession(s.key)} title=${t("chat.openInChat")} aria-label=${t("chat.openInChat")}>${renderIcon("messageSquare", "12px")}</button>
                                   <button style="background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 4px 8px; cursor: pointer; font-size: 11px; color: var(--foreground); display: inline-flex; align-items: center;"
                                    @click=${() => this.resetSession(s.key)} title=${t("chat.resetMessages")} aria-label=${t("chat.resetMessages")}>${renderIcon("refresh", "12px")}</button>
                                   <button style="background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 4px 8px; cursor: pointer; font-size: 11px; color: var(--destructive, #ef4444); display: inline-flex; align-items: center;"
                                    @click=${() => this.confirmDelete === s.key ? this.deleteSession(s.key) : (this.confirmDelete = s.key)} title=${t("common.delete")} aria-label=${t("common.delete")}>
                                      ${this.confirmDelete === s.key ? t("sessions.confirmDelete") : renderIcon("trash", "12px")}
                                   </button>
                                </div>
                             </td>
                          </tr>
                       `;
                    })}
                 </tbody>
              </table>
           </div>
        ` : ""}
      </div>
    `;
  }
}
