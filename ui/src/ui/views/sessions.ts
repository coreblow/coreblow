import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { CoreBlowApp } from "../app.ts";

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

  createRenderRoot() { return this; }

  connectedCallback() {
      super.connectedCallback();
      this.loadSessions();
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
      if (diff < 60_000) return "just now";
      if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
      if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
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
                 <div class="card-title">Sessions</div>
                 <div class="card-sub">${this.sessions.length} session${this.sessions.length !== 1 ? "s" : ""} managed by AgentEngine</div>
              </div>
              <button class="btn" style="background: var(--accent); color: var(--primary-foreground); border:none; padding: 8px 16px; border-radius: var(--radius-sm); cursor: pointer; font-weight: 600;"
               @click=${this.createNewSession}>+ New Session</button>
              <button class="btn" style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground);"
               @click=${() => this.loadSessions()}>↻ Refresh</button>
           </div>

           <!-- Search + Bulk Actions -->
           <div style="margin-top: 16px; display: flex; gap: 12px; align-items: center;">
              <input style="flex: 1; background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 12px; border-radius: var(--radius-sm); color: var(--foreground); font-family: var(--font-sans);"
                     placeholder="Search sessions..."
                     .value=${this.searchQuery}
                     @input=${(e: Event) => this.searchQuery = (e.target as HTMLInputElement).value} />
              ${hasSelected ? html`
                 <button class="btn" style="background: var(--destructive, #ef4444); color: white; border: none; padding: 8px 16px; border-radius: var(--radius-sm); cursor: pointer; font-size: 12px;"
                  @click=${this.deleteSelected}>Delete ${this.selectedKeys.size} selected</button>
              ` : ""}
           </div>
        </div>

        ${this.loading ? html`<div style="text-align: center; color: var(--muted); padding: 40px;">Loading sessions...</div>` : ""}

        ${!this.loading && rows.length === 0 ? html`
           <div class="card" style="text-align: center; padding: 40px;">
              <div style="font-size: 32px; margin-bottom: 12px; opacity: 0.4;">🐙</div>
              <div style="color: var(--muted);">No sessions found</div>
              <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">Start a chat to create your first session</div>
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
                           @click=${() => this.toggleSort("key")}>Session${this.renderSortIcon("key")}</th>
                       <th style="padding: 10px 12px; text-align: left; color: var(--muted);">Model</th>
                       <th style="padding: 10px 12px; text-align: center; color: var(--muted);">Turns</th>
                       <th style="padding: 10px 12px; text-align: right; cursor: pointer; user-select: none; color: var(--muted);"
                           @click=${() => this.toggleSort("tokens")}>Tokens${this.renderSortIcon("tokens")}</th>
                       <th style="padding: 10px 12px; text-align: right; cursor: pointer; user-select: none; color: var(--muted);"
                           @click=${() => this.toggleSort("updated")}>Updated${this.renderSortIcon("updated")}</th>
                       <th style="padding: 10px 12px; text-align: center; color: var(--muted);">Actions</th>
                    </tr>
                 </thead>
                 <tbody>
                    ${rows.map(s => {
                       const isActive = s.key === activeKey;
                       const isSelected = this.selectedKeys.has(s.key);
                       return html`
                          <tr style="border-bottom: 1px solid var(--border); ${isActive ? 'background: rgba(99,102,241,0.08);' : ''} transition: background 0.15s ease;"
                              @mouseenter=${(e: Event) => (e.currentTarget as HTMLElement).style.background = isActive ? 'rgba(99,102,241,0.12)' : 'var(--bg-elevated)'}
                              @mouseleave=${(e: Event) => (e.currentTarget as HTMLElement).style.background = isActive ? 'rgba(99,102,241,0.08)' : ''}>
                             <td style="padding: 10px 12px;">
                                <input type="checkbox" .checked=${isSelected} 
                                       @change=${() => {
                                          const next = new Set(this.selectedKeys);
                                          isSelected ? next.delete(s.key) : next.add(s.key);
                                          this.selectedKeys = next;
                                       }} />
                             </td>
                             <td style="padding: 10px 12px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                   ${isActive ? html`<span style="width: 8px; height: 8px; border-radius: 50%; background: var(--accent, #6366f1); flex-shrink: 0;"></span>` : ""}
                                   <span style="font-family: var(--mono); font-size: 12px; ${isActive ? 'color: var(--accent); font-weight: 600;' : ''}">${s.key.length > 20 ? s.key.slice(0, 20) + "…" : s.key}</span>
                                </div>
                             </td>
                             <td style="padding: 10px 12px;">
                                <span style="font-size: 11px; padding: 2px 8px; background: var(--bg-elevated); border-radius: 12px; color: var(--muted);">${s.model || "default"}</span>
                             </td>
                             <td style="padding: 10px 12px; text-align: center;">${s.turnCount}</td>
                             <td style="padding: 10px 12px; text-align: right; font-family: var(--mono); font-size: 12px;">${this.formatTokens(s.totalTokens)}</td>
                             <td style="padding: 10px 12px; text-align: right; font-size: 12px; color: var(--muted);">${this.formatTime(s.updatedAt)}</td>
                             <td style="padding: 10px 12px; text-align: center;">
                                <div style="display: flex; gap: 4px; justify-content: center;">
                                   <button style="background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 4px 8px; cursor: pointer; font-size: 11px; color: var(--foreground);"
                                    @click=${() => this.switchToSession(s.key)} title="Open in chat">💬</button>
                                   <button style="background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 4px 8px; cursor: pointer; font-size: 11px; color: var(--foreground);"
                                    @click=${() => this.resetSession(s.key)} title="Reset messages">🔄</button>
                                   <button style="background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 4px 8px; cursor: pointer; font-size: 11px; color: var(--destructive, #ef4444);"
                                    @click=${() => this.confirmDelete === s.key ? this.deleteSession(s.key) : (this.confirmDelete = s.key)} title="Delete">
                                      ${this.confirmDelete === s.key ? "Confirm?" : "🗑️"}
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
