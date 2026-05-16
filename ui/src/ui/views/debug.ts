import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { t } from "../../i18n/index.ts";
import type { CoreBlowApp } from "../app.ts";

type RpcLogEntry = {
   id: number;
   ts: number;
   method: string;
   params: unknown;
   result?: unknown;
   error?: string;
   durationMs?: number;
};

@customElement("coreblow-debug-view")
export class DebugView extends LitElement {
  @property({ attribute: false }) app!: CoreBlowApp;

  @state() rpcLog: RpcLogEntry[] = [];
  @state() rpcInput = "";
  @state() rpcParams = "{}";
  @state() rpcResult: string | null = null;
  @state() rpcError: string | null = null;
  @state() rpcSending = false;
  @state() filterQuery = "";
  @state() showEvents = true;
  @state() showRpc = true;
  @state() autoScroll = true;

  private _nextId = 1;

  createRenderRoot() { return this; }

  private async sendRpc() {
     const method = this.rpcInput.trim();
     if (!method) return;
     const client = this.app.gateway.getClient();
     if (!client?.connected) { this.rpcError = t("overview.status.notConnected"); return; }

     let params: unknown;
     try { params = JSON.parse(this.rpcParams || "{}"); } catch { this.rpcError = t("config.invalidJson"); return; }

     const entry: RpcLogEntry = { id: this._nextId++, ts: Date.now(), method, params };
     this.rpcSending = true;
     this.rpcResult = null;
     this.rpcError = null;

     const start = performance.now();
     try {
        const result = await client.request<unknown>(method, params as Record<string, unknown>);
        entry.result = result;
        entry.durationMs = Math.round(performance.now() - start);
        this.rpcResult = JSON.stringify(result, null, 2);
     } catch (err: unknown) {
        entry.error = err instanceof Error ? err.message : String(err);
        entry.durationMs = Math.round(performance.now() - start);
        this.rpcError = entry.error;
     }
     this.rpcLog = [entry, ...this.rpcLog].slice(0, 200);
     this.rpcSending = false;
  }

  private clearLog() { this.rpcLog = []; }

  private get filteredEvents() {
     const logs = this.app.eventLog;
     if (!this.filterQuery) return logs;
     const q = this.filterQuery.toLowerCase();
     return logs.filter(e => e.raw.toLowerCase().includes(q));
  }

  private renderRpcConsole() {
     return html`
        <div class="card">
           <div class="card-title">🔧 ${t("debug.rpcConsole")}</div>
           <div class="card-sub">${t("debug.rpcConsoleSubtitle")}</div>
           <div style="margin-top: 12px; display: grid; gap: 8px;">
              <div style="display: flex; gap: 8px;">
                 <input style="flex: 1; background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 10px; border-radius: var(--radius-sm); color: var(--foreground); font-family: var(--mono); font-size: 12px;"
                        placeholder=${t("debug.methodPlaceholder")}
                        .value=${this.rpcInput}
                        @input=${(e: Event) => this.rpcInput = (e.target as HTMLInputElement).value}
                        @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter") this.sendRpc(); }} />
                 <button style="background: var(--accent); color: white; border: none; padding: 8px 16px; border-radius: var(--radius-sm); cursor: pointer; font-weight: 600; font-size: 12px;"
                         ?disabled=${this.rpcSending}
                         @click=${this.sendRpc}>${this.rpcSending ? "..." : t("common.send")}</button>
              </div>
              <textarea style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 10px; border-radius: var(--radius-sm); color: var(--foreground); font-family: var(--mono); font-size: 11px; resize: vertical; min-height: 40px;"
                        placeholder='{"key": "value"}'
                        .value=${this.rpcParams}
                        @input=${(e: Event) => this.rpcParams = (e.target as HTMLTextAreaElement).value}></textarea>

              ${this.rpcResult ? html`
                 <details open>
                    <summary style="cursor: pointer; font-size: 12px; color: var(--success, #22c55e); font-weight: 600;">✓ ${t("debug.response")}</summary>
                    <pre style="margin-top: 4px; background: var(--bg-elevated); padding: 10px 12px; border-radius: var(--radius-sm); font-size: 11px; font-family: var(--mono); max-height: 300px; overflow: auto; border: 1px solid rgba(34,197,94,0.2); color: var(--foreground);">${this.rpcResult}</pre>
                 </details>
              ` : ""}
              ${this.rpcError ? html`
                 <div style="padding: 8px 12px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: var(--radius-sm); font-size: 12px; color: var(--destructive, #ef4444);">✗ ${this.rpcError}</div>
              ` : ""}
           </div>
        </div>
     `;
  }

  private renderQuickRpc() {
     const methods = [
        "health.snapshot", "sys.presence", "sessions.list", "models.list",
        "config.get", "agents.list", "tools.list",
     ];
     return html`
        <div class="card">
           <div class="card-title" style="font-size: 14px;">⚡ ${t("debug.quickRpc")}</div>
           <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px;">
              ${methods.map(m => html`
                 <button style="font-family: var(--mono); font-size: 11px; padding: 4px 10px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; color: var(--accent, #6366f1); transition: border-color 0.15s;"
                  @click=${() => { this.rpcInput = m; this.rpcParams = "{}"; this.sendRpc(); }}>${m}</button>
              `)}
           </div>
        </div>
     `;
  }

  private renderRpcHistory() {
     if (this.rpcLog.length === 0) return "";
     return html`
        <div class="card">
           <div style="display: flex; align-items: center; gap: 8px;">
              <div class="card-title" style="flex: 1; font-size: 14px;">📋 ${t("debug.rpcHistory")}</div>
              <span style="font-size: 11px; color: var(--muted);">${t("debug.callsSummary", { count: String(this.rpcLog.length) })}</span>
              <button style="font-size: 11px; background: none; border: 1px solid var(--border); padding: 2px 8px; border-radius: var(--radius-sm); cursor: pointer; color: var(--muted);"
               @click=${this.clearLog}>${t("logs.clear")}</button>
           </div>
           <div style="margin-top: 8px; max-height: 300px; overflow-y: auto;">
              ${this.rpcLog.map(entry => html`
                 <div style="padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 12px; display: flex; gap: 8px; align-items: center;">
                    <span style="font-family: var(--mono); color: var(--muted); min-width: 60px;">${new Date(entry.ts).toLocaleTimeString()}</span>
                    <span style="font-family: var(--mono); color: var(--accent, #6366f1); font-weight: 600; min-width: 140px;">${entry.method}</span>
                    <span style="font-size: 11px; color: ${entry.error ? 'var(--destructive, #ef4444)' : 'var(--success, #22c55e)'};">${entry.error ? "✗" : "✓"}</span>
                    ${entry.durationMs != null ? html`<span style="font-size: 11px; color: var(--muted);">${entry.durationMs}ms</span>` : ""}
                 </div>
              `)}
           </div>
        </div>
     `;
  }

  private renderEventStream() {
     const events = this.filteredEvents;
     return html`
        <div class="card">
           <div style="display: flex; align-items: center; gap: 8px;">
              <div class="card-title" style="flex: 1; font-size: 14px;">📡 ${t("debug.eventStream")}</div>
              <input style="width: 180px; background: var(--bg-elevated); border: 1px solid var(--border); padding: 4px 8px; border-radius: var(--radius-sm); color: var(--foreground); font-size: 11px;"
                     placeholder=${t("debug.filterEventsPlaceholder")}
                     .value=${this.filterQuery}
                     @input=${(e: Event) => this.filterQuery = (e.target as HTMLInputElement).value} />
              <span style="font-size: 11px; color: var(--muted);">${events.length} / ${this.app.eventLog.length}</span>
           </div>
           <div style="margin-top: 8px; background: var(--bg-elevated); border-radius: var(--radius-sm); max-height: 400px; overflow-y: auto; font-family: var(--mono); font-size: 11px;">
              ${events.length === 0 ? html`<div style="padding: 24px; text-align: center; color: var(--muted);">${t("debug.noEvents")}</div>` : ""}
              ${events.slice(0, 100).map(e => html`
                 <div style="padding: 4px 10px; border-bottom: 1px solid rgba(255,255,255,0.02); display: flex; gap: 8px;">
                    <span style="color: var(--muted); min-width: 70px; flex-shrink: 0;">${new Date(e.ts).toLocaleTimeString()}</span>
                    <span style="color: ${e.level === 'error' ? 'var(--destructive)' : e.level === 'warn' ? 'var(--warning)' : 'var(--foreground)'}; word-break: break-all;">${e.raw}</span>
                 </div>
              `)}
           </div>
        </div>
     `;
  }

  private renderConnectionInfo() {
     const connected = this.app.connected;
     return html`
        <div class="card">
           <div class="card-title" style="font-size: 14px;">🌐 ${t("debug.connection")}</div>
           <div style="margin-top: 8px;">
              <div style="display: flex; align-items: center; gap: 8px; padding: 6px 0;">
                 <span style="width: 10px; height: 10px; border-radius: 50%; background: ${connected ? 'var(--success, #22c55e)' : 'var(--destructive, #ef4444)'}; ${connected ? 'box-shadow: 0 0 8px rgba(34,197,94,0.4);' : ''}"></span>
                 <span style="font-weight: 600;">${connected ? t("overview.status.connected") : t("overview.status.disconnected")}</span>
              </div>
              <div style="font-size: 12px; color: var(--muted); font-family: var(--mono); padding: 4px 0;">${this.app.settings.gatewayUrl}</div>
           </div>
        </div>
     `;
  }

  render() {
    return html`
      <div style="display: flex; flex-direction: column; gap: 16px;">
         ${this.renderConnectionInfo()}
         ${this.renderRpcConsole()}
         ${this.renderQuickRpc()}
         ${this.renderRpcHistory()}
         ${this.renderEventStream()}
      </div>
    `;
  }
}
