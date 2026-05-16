import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { t } from "../../i18n/index.ts";
import type { CoreBlowApp } from "../app.ts";

type AgentRow = {
   id: string;
   name: string;
   model: string;
   state: string;
   turnCount: number;
   totalTokens: number;
};

@customElement("coreblow-agents-view")
export class AgentsView extends LitElement {
  @property({ attribute: false }) app!: CoreBlowApp;
  @state() agents: AgentRow[] = [];
  @state() loading = false;
  @state() tools: { name: string; description?: string; category?: string }[] = [];
  @state() showCreateForm = false;
  @state() newModel = "";
  @state() newPrompt = "";

  createRenderRoot() { return this; }

  connectedCallback() {
      super.connectedCallback();
      this.loadData();
  }

  private async loadData() {
      const client = this.app.gateway.getClient();
      if (!client?.connected) return;
      this.loading = true;
      try {
         const [agentsRes, toolsRes] = await Promise.all([
            client.request<AgentRow[]>("agents.list", {}),
            client.request<{ tools: { name: string; description?: string; category?: string }[] }>("tools.list", {}).catch(() => ({ tools: [] })),
         ]);
         this.agents = Array.isArray(agentsRes) ? agentsRes : [];
         this.tools = toolsRes?.tools ?? [];
      } catch { this.agents = []; this.tools = []; }
      this.loading = false;
  }

  private async createAgent() {
      const client = this.app.gateway.getClient();
      if (!client?.connected) return;
      await client.request("agents.create", {
         name: `Agent ${Date.now()}`,
         model: this.newModel || undefined,
         systemPrompt: this.newPrompt || undefined,
      }).catch(() => {});
      this.showCreateForm = false;
      this.newModel = "";
      this.newPrompt = "";
      this.loadData();
  }

  private async deleteAgent(id: string) {
      const client = this.app.gateway.getClient();
      if (!client?.connected) return;
      await client.request("agents.delete", { agentId: id }).catch(() => {});
      this.loadData();
  }

  private renderAgentCard(a: AgentRow) {
      const stateColor = a.state === "idle" ? "var(--success, #22c55e)" : a.state === "running" ? "var(--warning, #f59e0b)" : "var(--muted)";
      return html`
         <div style="background: var(--bg-elevated); padding: 16px; border-radius: var(--radius-md, 8px); border: 1px solid var(--border); transition: border-color 0.15s;">
            <div style="display: flex; align-items: center; gap: 10px;">
               <span style="font-size: 24px;">🤖</span>
               <div style="flex: 1;">
                  <div style="font-weight: 700; font-size: 14px;">${t("agents.agentLabel")}</div>
                  <div style="font-size: 11px; font-family: var(--mono); color: var(--muted);">${a.id.length > 24 ? a.id.slice(0, 24) + "…" : a.id}</div>
               </div>
               <span style="width: 8px; height: 8px; border-radius: 50%; background: ${stateColor};"></span>
            </div>

            <div style="margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
               <div>
                  <div style="color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;">${t("agents.model")}</div>
                  <div style="font-family: var(--mono); margin-top: 2px;">${a.model || t("chat.defaultModel")}</div>
               </div>
               <div>
                  <div style="color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;">${t("agents.state")}</div>
                  <div style="margin-top: 2px; color: ${stateColor}; font-weight: 600;">${a.state}</div>
               </div>
               <div>
                  <div style="color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;">${t("agents.turns")}</div>
                  <div style="margin-top: 2px;">${a.turnCount}</div>
               </div>
               <div>
                  <div style="color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;">${t("agents.tokens")}</div>
                  <div style="font-family: var(--mono); margin-top: 2px;">${a.totalTokens > 1000 ? (a.totalTokens / 1000).toFixed(1) + "K" : a.totalTokens}</div>
               </div>
            </div>

            <div style="margin-top: 12px; display: flex; gap: 6px;">
               <button style="flex: 1; background: var(--accent); color: white; border: none; padding: 6px; border-radius: var(--radius-sm); cursor: pointer; font-size: 11px; font-weight: 600;"
                @click=${() => { this.app.chat.sessionKey = a.id; this.app.setTab("chat" as any); }}>💬 ${t("tabs.chat")}</button>
               <button style="background: none; border: 1px solid var(--border); padding: 6px 10px; border-radius: var(--radius-sm); cursor: pointer; font-size: 11px; color: var(--destructive, #ef4444);"
                @click=${() => this.deleteAgent(a.id)}>🗑️</button>
            </div>
         </div>
      `;
  }

  private renderToolsList() {
      if (this.tools.length === 0) return "";
      const grouped = new Map<string, typeof this.tools>();
      for (const t of this.tools) {
         const cat = t.category || "general";
         if (!grouped.has(cat)) grouped.set(cat, []);
         grouped.get(cat)!.push(t);
      }
      return html`
         <div class="card">
            <div class="card-title" style="font-size: 14px;">🔧 ${t("agents.registeredTools")}</div>
            <div class="card-sub">${t("agents.toolsAvailable", { count: String(this.tools.length) })}</div>
            <div style="margin-top: 12px;">
               ${[...grouped.entries()].map(([cat, items]) => html`
                  <div style="margin-bottom: 12px;">
                     <div style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin-bottom: 6px;">${cat}</div>
                     <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                        ${items.map(t => html`
                           <span title="${t.description || t.name}" style="font-family: var(--mono); font-size: 11px; padding: 3px 10px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--accent, #6366f1); cursor: default;">${t.name}</span>
                        `)}
                     </div>
                  </div>
               `)}
            </div>
         </div>
      `;
  }

  render() {
    return html`
      <div style="display: flex; flex-direction: column; gap: 16px;">

         <!-- Header -->
         <div class="card">
            <div style="display: flex; align-items: center; gap: 12px;">
               <div style="flex: 1;">
                  <div class="card-title">🤖 ${t("agents.title")}</div>
                  <div class="card-sub">${t("agents.activeSummary", { count: String(this.agents.length) })}</div>
               </div>
               <button class="btn" style="background: var(--accent); color: white; border: none; padding: 8px 16px; border-radius: var(--radius-sm); cursor: pointer; font-weight: 600;"
                @click=${() => this.showCreateForm = !this.showCreateForm}>+ ${t("agents.newAgent")}</button>
               <button class="btn" style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground);"
                @click=${() => this.loadData()}>↻ ${t("common.refresh")}</button>
            </div>

            ${this.showCreateForm ? html`
               <div style="margin-top: 16px; padding: 16px; background: var(--bg-elevated); border-radius: var(--radius-sm); border: 1px solid var(--border);">
                  <div style="font-weight: 600; font-size: 13px; margin-bottom: 10px;">${t("agents.createAgent")}</div>
                  <div style="display: grid; gap: 8px;">
                     <input style="background: var(--bg-surface, #1a1a2e); border: 1px solid var(--border); padding: 8px 10px; border-radius: var(--radius-sm); color: var(--foreground); font-family: var(--mono); font-size: 12px;"
                            placeholder=${t("agents.modelPlaceholder")}
                            .value=${this.newModel}
                            @input=${(e: Event) => this.newModel = (e.target as HTMLInputElement).value} />
                     <textarea style="background: var(--bg-surface, #1a1a2e); border: 1px solid var(--border); padding: 8px 10px; border-radius: var(--radius-sm); color: var(--foreground); font-size: 12px; resize: vertical; min-height: 60px;"
                               placeholder=${t("agents.systemPromptPlaceholder")}
                               .value=${this.newPrompt}
                               @input=${(e: Event) => this.newPrompt = (e.target as HTMLTextAreaElement).value}></textarea>
                     <div style="display: flex; gap: 8px; justify-content: flex-end;">
                        <button style="background: none; border: 1px solid var(--border); padding: 6px 14px; border-radius: var(--radius-sm); cursor: pointer; color: var(--muted); font-size: 12px;"
                         @click=${() => this.showCreateForm = false}>${t("agents.cancel")}</button>
                        <button style="background: var(--accent); color: white; border: none; padding: 6px 14px; border-radius: var(--radius-sm); cursor: pointer; font-weight: 600; font-size: 12px;"
                         @click=${this.createAgent}>${t("agents.create")}</button>
                     </div>
                  </div>
               </div>
            ` : ""}
         </div>

         ${this.loading ? html`<div style="text-align: center; padding: 40px; color: var(--muted);">${t("agents.loading")}</div>` : ""}

         ${!this.loading && this.agents.length === 0 ? html`
            <div class="card" style="text-align: center; padding: 40px;">
               <div style="font-size: 40px; margin-bottom: 12px; opacity: 0.3;">🤖</div>
               <div style="color: var(--muted);">${t("agents.emptyTitle")}</div>
               <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">${t("agents.emptySubtitle")}</div>
            </div>
         ` : ""}

         ${this.agents.length > 0 ? html`
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
               ${this.agents.map(a => this.renderAgentCard(a))}
            </div>
         ` : ""}

         ${this.renderToolsList()}
      </div>
    `;
  }
}
