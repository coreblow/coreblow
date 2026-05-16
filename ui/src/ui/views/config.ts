import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { t } from "../../i18n/index.ts";
import type { CoreBlowApp } from "../app.ts";

type EngineConfig = {
   defaultModel?: string;
   defaultProvider?: string;
   maxConcurrentSessions?: number;
   maxTurnsPerRun?: number;
   maxOutputTokens?: number;
   contextWindow?: number;
   sandboxBaseDir?: string;
   toolApproval?: { autoApprove?: string[]; requireApproval?: string[]; deny?: string[] };
   providers?: string[];
   activeSessions?: number;
   registeredTools?: string[];
};

@customElement("coreblow-config-view")
export class ConfigView extends LitElement {
  @property({ attribute: false }) app!: CoreBlowApp;
  @state() config: EngineConfig | null = null;
  @state() loading = false;
  @state() saving = false;
  @state() editModel = "";
  @state() editProvider = "";
  @state() apiKeyInput = "";
  @state() viewMode: "visual" | "raw" = "visual";
  @state() saveStatus: string | null = null;

  createRenderRoot() { return this; }

  connectedCallback() {
      super.connectedCallback();
      this.loadConfig();
  }

  private async loadConfig() {
      const client = this.app.gateway.getClient();
      if (!client?.connected) return;
      this.loading = true;
      try {
         const res = await client.request<{ config: EngineConfig }>("config.get", {});
         this.config = res?.config ?? null;
         if (this.config) {
            this.editModel = this.config.defaultModel ?? "";
            this.editProvider = this.config.defaultProvider ?? "";
         }
      } catch { this.config = null; }
      this.loading = false;
  }

  private async saveField(path: string, value: unknown) {
      const client = this.app.gateway.getClient();
      if (!client?.connected) return;
      this.saving = true;
      try {
         await client.request("config.set", { path, value });
         this.saveStatus = `✓ ${t("config.updated", { path })}`;
         setTimeout(() => this.saveStatus = null, 2000);
         this.loadConfig();
      } catch (err: unknown) {
         const msg = err instanceof Error ? err.message : String(err);
         this.saveStatus = `✗ ${t("config.saveFailed", { message: msg })}`;
      }
      this.saving = false;
  }

  private renderField(label: string, value: unknown, mono = false) {
      const display = value === undefined || value === null ? "—" : String(value);
      return html`
         <div class="config-field" style="display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border);">
            <span class="config-label" style="min-width: 180px; font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">${label}</span>
            <span style="flex: 1; ${mono ? 'font-family: var(--mono); font-size: 12px;' : ''}">${display}</span>
         </div>
      `;
  }

  private renderEditableField(label: string, value: string, path: string, onInput: (v: string) => void) {
      return html`
         <div class="config-field" style="display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border); gap: 12px;">
            <span class="config-label" style="min-width: 180px; font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">${label}</span>
            <input style="flex: 1; background: var(--bg-elevated); border: 1px solid var(--border); padding: 6px 10px; border-radius: var(--radius-sm); color: var(--foreground); font-family: var(--mono); font-size: 12px;"
                   .value=${value}
                   @input=${(e: Event) => onInput((e.target as HTMLInputElement).value)} />
            <button style="background: var(--accent); color: white; border: none; padding: 6px 14px; border-radius: var(--radius-sm); cursor: pointer; font-size: 11px; font-weight: 600;"
                    ?disabled=${this.saving}
                    @click=${() => this.saveField(path, value)}>${t("config.save")}</button>
         </div>
      `;
  }

  render() {
    const c = this.config;

    return html`
      <div style="display: flex; flex-direction: column; gap: 16px;">

         <!-- Header -->
         <div class="card">
            <div style="display: flex; align-items: center; gap: 12px;">
               <div style="flex: 1;">
                  <div class="card-title">⚙️ ${t("config.title")}</div>
                  <div class="card-sub">${t("config.subtitle")}</div>
               </div>
               <div style="display: flex; gap: 8px;">
                  <button class="btn" style="background: ${this.viewMode === 'visual' ? 'var(--accent)' : 'var(--bg-elevated)'}; color: ${this.viewMode === 'visual' ? 'white' : 'var(--foreground)'}; border: 1px solid var(--border); padding: 6px 14px; border-radius: var(--radius-sm); cursor: pointer; font-size: 12px;"
                   @click=${() => this.viewMode = "visual"}>${t("config.visual")}</button>
                  <button class="btn" style="background: ${this.viewMode === 'raw' ? 'var(--accent)' : 'var(--bg-elevated)'}; color: ${this.viewMode === 'raw' ? 'white' : 'var(--foreground)'}; border: 1px solid var(--border); padding: 6px 14px; border-radius: var(--radius-sm); cursor: pointer; font-size: 12px;"
                   @click=${() => this.viewMode = "raw"}>JSON</button>
               </div>
               <button class="btn" style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 6px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); font-size: 12px;"
                @click=${() => this.loadConfig()}>↻ ${t("common.refresh")}</button>
            </div>
            ${this.saveStatus ? html`<div style="margin-top: 8px; font-size: 12px; color: ${this.saveStatus.startsWith("✓") ? "var(--success, #22c55e)" : "var(--destructive, #ef4444)"};">${this.saveStatus}</div>` : ""}
         </div>

         ${this.loading ? html`<div class="card" style="text-align: center; padding: 40px; color: var(--muted);">${t("config.loading")}</div>` : ""}

         ${!this.loading && this.viewMode === "raw" && c ? html`
            <div class="card">
               <pre style="background: var(--bg-elevated); padding: 16px; border-radius: var(--radius-sm); color: var(--foreground); font-family: var(--mono); font-size: 12px; overflow-x: auto; max-height: 600px; overflow-y: auto;">${JSON.stringify(c, null, 2)}</pre>
            </div>
         ` : ""}

         ${!this.loading && this.viewMode === "visual" && c ? html`
            <!-- Model & Provider -->
            <div class="card">
               <div class="card-title" style="font-size: 14px;">🤖 ${t("config.modelConfiguration")}</div>
               ${this.renderEditableField(t("agents.defaultModel"), this.editModel, "defaultModel", v => this.editModel = v)}
               ${this.renderEditableField(t("agents.defaultProvider"), this.editProvider, "defaultProvider", v => this.editProvider = v)}
            </div>

            <!-- Engine Limits -->
            <div class="card">
               <div class="card-title" style="font-size: 14px;">📊 ${t("config.engineLimits")}</div>
               ${this.renderField(t("sessions.maxConcurrent"), c.maxConcurrentSessions)}
               ${this.renderField(t("agents.maxTurns"), c.maxTurnsPerRun)}
               ${this.renderField(t("agents.maxOutput"), c.maxOutputTokens?.toLocaleString())}
               ${this.renderField(t("agents.contextWindow"), c.contextWindow?.toLocaleString())}
               ${this.renderField(t("agents.sandboxDir"), c.sandboxBaseDir, true)}
            </div>

            <!-- Tool Policy -->
            <div class="card">
               <div class="card-title" style="font-size: 14px;">🔧 ${t("config.toolPolicy")}</div>
               <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 12px;">
                  <div>
                     <div style="font-size: 11px; color: var(--success, #22c55e); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">${t("config.autoApprove")}</div>
                     ${(c.toolApproval?.autoApprove ?? []).map(t => html`<div style="font-family: var(--mono); font-size: 12px; padding: 2px 0;">${t}</div>`)}
                  </div>
                  <div>
                     <div style="font-size: 11px; color: var(--warning, #f59e0b); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">${t("config.requireApproval")}</div>
                     ${(c.toolApproval?.requireApproval ?? []).map(t => html`<div style="font-family: var(--mono); font-size: 12px; padding: 2px 0;">${t}</div>`)}
                  </div>
                  <div>
                     <div style="font-size: 11px; color: var(--destructive, #ef4444); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">${t("config.denied")}</div>
                     ${(c.toolApproval?.deny ?? []).length === 0 ? html`<div style="font-size: 12px; color: var(--muted);">${t("common.none")}</div>` : ""}
                     ${(c.toolApproval?.deny ?? []).map(t => html`<div style="font-family: var(--mono); font-size: 12px; padding: 2px 0;">${t}</div>`)}
                  </div>
               </div>
            </div>

            <!-- Runtime Info -->
            <div class="card">
               <div class="card-title" style="font-size: 14px;">📡 ${t("config.runtimeStatus")}</div>
               ${this.renderField(t("sessions.active"), c.activeSessions)}
               ${this.renderField(t("agents.registeredTools"), t("config.toolsCount", { count: String(c.registeredTools?.length ?? 0) }))}
               ${c.registeredTools && c.registeredTools.length > 0 ? html`
                  <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px;">
                     ${c.registeredTools.map(t => html`
                        <span style="font-size: 11px; padding: 2px 8px; background: var(--bg-elevated); border-radius: 12px; font-family: var(--mono); color: var(--accent, #6366f1);">${t}</span>
                     `)}
                  </div>
               ` : ""}
            </div>

            <!-- Gateway Connection -->
            <div class="card">
               <div class="card-title" style="font-size: 14px;">🌐 ${t("config.gatewayConnection")}</div>
               ${this.renderField(t("common.url"), this.app.settings.gatewayUrl, true)}
               ${this.renderField(t("common.status"), this.app.connected ? `🟢 ${t("overview.status.connected")}` : `🔴 ${t("overview.status.disconnected")}`)}
            </div>
         ` : ""}
      </div>
    `;
  }
}
