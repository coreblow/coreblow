import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { CoreBlowApp } from "../app.ts";

@customElement("coreblow-overview-view")
export class OverviewView extends LitElement {
  @property({ attribute: false }) app!: CoreBlowApp;

  createRenderRoot() { return this; }

  private formatUptime(): string {
     const ms = Date.now() - (this.app as any)._startTime;
     if (!ms || isNaN(ms)) return "—";
     const s = Math.floor(ms / 1000);
     const m = Math.floor(s / 60);
     const h = Math.floor(m / 60);
     if (h > 0) return `${h}h ${m % 60}m`;
     if (m > 0) return `${m}m ${s % 60}s`;
     return `${s}s`;
  }

  render() {
    const connected = this.app.connected;
    const modelCount = this.app.chatModelCatalog.length;
    const sessionKey = this.app.chat.sessionKey;
    const approvalCount = this.app.approvalQueue.length;

    return html`
      <div style="display: flex; flex-direction: column; gap: 16px;">

        <!-- Status Banner -->
        <div class="card" style="background: ${connected ? 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(99,102,241,0.08))' : 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.04))'}; border: 1px solid ${connected ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.3)'};">
           <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 32px;">${connected ? "🐙" : "⚠️"}</span>
              <div>
                 <div style="font-weight: 700; font-size: 16px;">${connected ? "CoreBlow Online" : "Not Connected"}</div>
                 <div style="font-size: 12px; color: var(--muted);">${connected ? `Connected to ${this.app.settings.gatewayUrl}` : "Configure gateway URL below to connect"}</div>
              </div>
              ${approvalCount > 0 ? html`
                 <div style="margin-left: auto; background: var(--warning, #f59e0b); color: #000; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 700;">${approvalCount} pending approval</div>
              ` : ""}
           </div>
        </div>

        <!-- Stats Grid -->
        <div style="display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
           ${this.renderStatCard("🔌", "Status", connected ? "🟢 Connected" : "🔴 Offline")}
           ${this.renderStatCard("📊", "Sessions", String(this.app.sessionsCount))}
           ${this.renderStatCard("👥", "Peers", String(this.app.presenceCount))}
           ${this.renderStatCard("🤖", "Models", String(modelCount))}
           ${this.renderStatCard("💬", "Active Chat", sessionKey ? sessionKey.slice(0, 12) + "…" : "None")}
           ${this.renderStatCard("📝", "Events", String(this.app.eventLog.length))}
        </div>

        <!-- Quick Actions + Connection -->
        <div style="display: grid; gap: 16px; grid-template-columns: 1fr 1fr;">

           <!-- Gateway Connection -->
           <div class="card">
              <div class="card-title">🌐 Gateway Connection</div>
              <div style="margin-top: 12px; display: grid; gap: 10px;">
                <label class="field">
                   <span style="font-size: 12px; color: var(--muted);">URL</span>
                   <input style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 10px; border-radius: var(--radius-sm); color: var(--foreground); font-family: var(--mono); font-size: 12px;"
                          .value=${this.app.settings.gatewayUrl}
                          @input=${(e: Event) => this.app.applySettings({...this.app.settings, gatewayUrl: (e.target as HTMLInputElement).value})}/>
                </label>
                <label class="field">
                   <span style="font-size: 12px; color: var(--muted);">Token</span>
                   <input type="password"
                          style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 10px; border-radius: var(--radius-sm); color: var(--foreground); font-family: var(--mono); font-size: 12px;"
                          .value=${this.app.settings.token}
                          @input=${(e: Event) => this.app.applySettings({...this.app.settings, token: (e.target as HTMLInputElement).value})}/>
                </label>
                <button class="btn" style="background: var(--accent); color: var(--primary-foreground); border:none; padding: 10px 16px; border-radius: var(--radius-sm); cursor: pointer; font-weight: 600; transition: filter 0.15s;"
                 @click=${() => this.app.gateway.reconnect()}>
                   ${connected ? "↻ Reconnect" : "Connect to Gateway"}
                </button>
              </div>
           </div>

           <!-- Quick Actions -->
           <div class="card">
              <div class="card-title">⚡ Quick Actions</div>
              <div style="margin-top: 12px; display: grid; gap: 8px;">
                 <button class="btn" style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 10px 16px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); text-align: left; transition: border-color 0.15s;"
                  @click=${() => this.app.setTab("chat" as any)}>
                    💬 Open Chat
                 </button>
                 <button class="btn" style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 10px 16px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); text-align: left; transition: border-color 0.15s;"
                  @click=${() => this.app.setTab("sessions" as any)}>
                    📋 View Sessions
                 </button>
                 <button class="btn" style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 10px 16px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); text-align: left; transition: border-color 0.15s;"
                  @click=${() => this.app.setTab("config" as any)}>
                    ⚙️ Configuration
                 </button>
                 <button class="btn" style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 10px 16px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); text-align: left; transition: border-color 0.15s;"
                  @click=${() => this.app.setTab("debug" as any)}>
                    🔍 Debug Console
                 </button>
              </div>
           </div>
        </div>

        <!-- Event Log -->
        <div class="card">
           <div style="display: flex; align-items: center; gap: 8px;">
              <div class="card-title" style="flex: 1;">📜 Recent Events</div>
              <span style="font-size: 11px; color: var(--muted);">${this.app.eventLog.length} entries</span>
           </div>
           <div style="margin-top: 12px; background: var(--bg-elevated); border-radius: var(--radius-sm); max-height: 300px; overflow-y: auto;">
              ${this.app.eventLog.length === 0 ? html`<div style="padding: 24px; text-align: center; color: var(--muted); font-size: 12px;">No events yet</div>` : ""}
              ${this.app.eventLog.slice(0, 30).map(e => html`
                 <div style="padding: 6px 12px; border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 12px; display: flex; gap: 8px;">
                    <span style="color: var(--muted); font-family: var(--mono); min-width: 70px; flex-shrink: 0;">${new Date(e.ts).toLocaleTimeString()}</span>
                    <span style="color: var(--foreground); word-break: break-all;">${e.raw}</span>
                 </div>
              `)}
           </div>
        </div>
      </div>
    `;
  }

  private renderStatCard(icon: string, label: string, value: string) {
     return html`
        <div class="card" style="padding: 16px; display: flex; align-items: center; gap: 12px;">
           <span style="font-size: 24px;">${icon}</span>
           <div>
              <div style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;">${label}</div>
              <div style="font-size: 16px; font-weight: 700; margin-top: 2px;">${value}</div>
           </div>
        </div>
     `;
  }
}
