import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { CoreBlowApp } from "../app.ts";

type PaletteItem = {
   id: string;
   label: string;
   icon: string;
   category: "navigation" | "action" | "rpc";
   action: string;
   description?: string;
};

const PALETTE_ITEMS: PaletteItem[] = [
   { id: "nav-overview", label: "Overview", icon: "📊", category: "navigation", action: "nav:overview" },
   { id: "nav-chat", label: "Chat", icon: "💬", category: "navigation", action: "nav:chat" },
   { id: "nav-sessions", label: "Sessions", icon: "📋", category: "navigation", action: "nav:sessions" },
   { id: "nav-agents", label: "AI Agents", icon: "🤖", category: "navigation", action: "nav:aiAgents" },
   { id: "nav-config", label: "Configuration", icon: "⚙️", category: "navigation", action: "nav:config" },
   { id: "nav-debug", label: "Debug Console", icon: "🔍", category: "navigation", action: "nav:debug" },
   { id: "nav-usage", label: "Usage & Metrics", icon: "📈", category: "navigation", action: "nav:usage" },
   { id: "nav-skills", label: "Skills", icon: "⚡", category: "navigation", action: "nav:skills" },
   { id: "nav-logs", label: "Logs", icon: "📜", category: "navigation", action: "nav:logs" },
   { id: "nav-cron", label: "Cron Jobs", icon: "⏰", category: "navigation", action: "nav:cron" },
   { id: "act-reconnect", label: "Reconnect Gateway", icon: "🔌", category: "action", action: "act:reconnect", description: "Reconnect to WebSocket" },
   { id: "act-new-session", label: "New Chat Session", icon: "➕", category: "action", action: "act:new-session", description: "Create a new chat session" },
   { id: "rpc-health", label: "health.snapshot", icon: "💗", category: "rpc", action: "rpc:health.snapshot", description: "Check system health" },
   { id: "rpc-sessions", label: "sessions.list", icon: "📋", category: "rpc", action: "rpc:sessions.list", description: "List active sessions" },
   { id: "rpc-models", label: "models.list", icon: "🤖", category: "rpc", action: "rpc:models.list", description: "List available models" },
];

@customElement("coreblow-command-palette")
export class CommandPalette extends LitElement {
  @property({ attribute: false }) app!: CoreBlowApp;
  @state() open = false;
  @state() query = "";
  @state() selectedIndex = 0;

  createRenderRoot() { return this; }

  connectedCallback() {
      super.connectedCallback();
      document.addEventListener("keydown", this._handleKeydown);
  }

  disconnectedCallback() {
      super.disconnectedCallback();
      document.removeEventListener("keydown", this._handleKeydown);
  }

  private _handleKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
         e.preventDefault();
         this.toggle();
         return;
      }
      if (!this.open) return;
      if (e.key === "Escape") { this.close(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); this.selectedIndex = Math.min(this.selectedIndex + 1, this.filtered.length - 1); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); this.selectedIndex = Math.max(this.selectedIndex - 1, 0); return; }
      if (e.key === "Enter") { e.preventDefault(); this.executeItem(this.filtered[this.selectedIndex]); return; }
  };

  toggle() { this.open = !this.open; if (this.open) { this.query = ""; this.selectedIndex = 0; } }
  close() { this.open = false; }

  private get filtered(): PaletteItem[] {
      if (!this.query) return PALETTE_ITEMS;
      const q = this.query.toLowerCase();
      return PALETTE_ITEMS.filter(item =>
         item.label.toLowerCase().includes(q) || (item.description ?? "").toLowerCase().includes(q)
      );
  }

  private executeItem(item?: PaletteItem) {
      if (!item) return;
      this.close();

      if (item.action.startsWith("nav:")) {
         const tab = item.action.replace("nav:", "");
         this.app.setTab(tab as any);
      } else if (item.action === "act:reconnect") {
         this.app.gateway.reconnect();
      } else if (item.action === "act:new-session") {
         const client = this.app.gateway.getClient();
         if (client?.connected) {
            client.request("sessions.create", {}).then((res: any) => {
               if (res?.id) { this.app.chat.sessionKey = res.id; this.app.setTab("chat" as any); }
            }).catch(() => {});
         }
      } else if (item.action.startsWith("rpc:")) {
         const method = item.action.replace("rpc:", "");
         this.app.setTab("debug" as any);
         // Dispatch to debug view
         this.app.addEventLog(`[CMD] Executed ${method}`);
      }
  }

  private categoryLabel(cat: string): string {
      if (cat === "navigation") return "Navigate";
      if (cat === "action") return "Actions";
      if (cat === "rpc") return "RPC Calls";
      return cat;
  }

  render() {
    if (!this.open) return html``;
    const items = this.filtered;
    const grouped = new Map<string, PaletteItem[]>();
    for (const item of items) {
       if (!grouped.has(item.category)) grouped.set(item.category, []);
       grouped.get(item.category)!.push(item);
    }
    let globalIndex = 0;

    return html`
      <div class="approval-overlay" @click=${(e: Event) => { if (e.target === e.currentTarget) this.close(); }}
           style="z-index: 10000; align-items: flex-start; padding-top: 15vh;">
         <div style="background: var(--bg-surface, #1e1e2e); border: 1px solid var(--border); border-radius: var(--radius-lg, 12px); width: 90%; max-width: 540px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); animation: modalSlideIn 0.15s ease; overflow: hidden;">

            <!-- Search Input -->
            <div style="padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px;">
               <span style="color: var(--muted); font-size: 14px;">🔍</span>
               <input autofocus style="flex: 1; background: transparent; border: none; outline: none; color: var(--foreground); font-size: 14px; font-family: var(--font-sans);"
                      placeholder="Type a command..."
                      .value=${this.query}
                      @input=${(e: Event) => { this.query = (e.target as HTMLInputElement).value; this.selectedIndex = 0; }} />
               <kbd style="font-size: 10px; padding: 2px 6px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 4px; color: var(--muted);">ESC</kbd>
            </div>

            <!-- Results -->
            <div style="max-height: 400px; overflow-y: auto; padding: 8px 0;">
               ${items.length === 0 ? html`
                  <div style="padding: 24px; text-align: center; color: var(--muted); font-size: 13px;">No commands found</div>
               ` : ""}
               ${[...grouped.entries()].map(([cat, catItems]) => {
                  return html`
                     <div style="padding: 6px 16px 4px; font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700;">${this.categoryLabel(cat)}</div>
                     ${catItems.map(item => {
                        const idx = globalIndex++;
                        const isSelected = idx === this.selectedIndex;
                        return html`
                           <div style="padding: 8px 16px; display: flex; align-items: center; gap: 10px; cursor: pointer; ${isSelected ? 'background: var(--bg-elevated);' : ''} transition: background 0.1s;"
                                @click=${() => this.executeItem(item)}
                                @mouseenter=${() => this.selectedIndex = idx}>
                              <span style="font-size: 16px; min-width: 24px; text-align: center;">${item.icon}</span>
                              <div style="flex: 1;">
                                 <div style="font-size: 13px; font-weight: ${isSelected ? '600' : '400'};">${item.label}</div>
                                 ${item.description ? html`<div style="font-size: 11px; color: var(--muted);">${item.description}</div>` : ""}
                              </div>
                              ${isSelected ? html`<span style="font-size: 11px; color: var(--muted);">↵</span>` : ""}
                           </div>
                        `;
                     })}
                  `;
               })}
            </div>

            <!-- Footer -->
            <div style="padding: 8px 16px; border-top: 1px solid var(--border); display: flex; gap: 12px; font-size: 10px; color: var(--muted);">
               <span>↑↓ navigate</span>
               <span>↵ select</span>
               <span>esc close</span>
               <span style="margin-left: auto;">⌘K to toggle</span>
            </div>
         </div>
      </div>
    `;
  }
}
