import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  i18n,
  I18nController,
  isSupportedLocale,
  SUPPORTED_LOCALES,
  t,
} from "../../i18n/index.ts";
import type { CoreBlowApp } from "../app.ts";
import { renderIcon, type IconName } from "../icons.ts";

@customElement("coreblow-overview-view")
export class OverviewView extends LitElement {
  private i18nController = new I18nController(this);
  @property({ attribute: false }) app!: CoreBlowApp;
  @state() private estopPaused = false;
  @state() private estopLoading = false;
  @state() private estopReason = "";

  createRenderRoot() { return this; }

  connectedCallback() {
    super.connectedCallback();
    void this.loadEstopStatus();
  }

  private getGatewayHttpUrl(): string {
    const wsUrl = this.app?.settings?.gatewayUrl;
    if (!wsUrl) return window.location.origin;
    try {
      const parsed = new URL(wsUrl);
      const protocol = parsed.protocol === "wss:" ? "https:" : "http:";
      return `${protocol}//${parsed.host}`;
    } catch {
      return window.location.origin;
    }
  }

  private async loadEstopStatus() {
    try {
      const url = `${this.getGatewayHttpUrl()}/api/corehub/system/estop`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as { ok?: boolean; paused?: boolean; reason?: string };
        if (data && typeof data.paused === "boolean") {
          this.estopPaused = data.paused;
          this.estopReason = data.reason ?? "";
        }
      }
    } catch {
      // Gracefully degrade if gateway offline
    }
  }

  private async toggleEstop() {
    const nextPaused = !this.estopPaused;
    this.estopLoading = true;
    try {
      const url = `${this.getGatewayHttpUrl()}/api/corehub/system/estop`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paused: nextPaused,
          reason: nextPaused ? "Paused via Web Control UI" : undefined,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { ok?: boolean; paused?: boolean; reason?: string };
        if (data && typeof data.paused === "boolean") {
          this.estopPaused = data.paused;
          this.estopReason = data.reason ?? "";
        } else {
          this.estopPaused = nextPaused;
        }
      }
    } catch (err) {
      console.error("Failed to toggle E-Stop:", err);
    } finally {
      this.estopLoading = false;
    }
  }

  private handleLocaleChange(event: Event) {
    const locale = (event.target as HTMLSelectElement).value;
    if (!isSupportedLocale(locale)) {
      return;
    }
    void i18n.setLocale(locale);
    this.app.applySettings({ ...this.app.settings, locale });
  }

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
    const currentLocale = isSupportedLocale(this.app.settings.locale) ? this.app.settings.locale : "en";

    return html`
      <div style="display: flex; flex-direction: column; gap: 16px;">

        <!-- Status Banner -->
        <div class="card" style="background: ${connected ? 'linear-gradient(135deg, rgba(34,197,94,0.06), rgba(99,102,241,0.06))' : 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(239,68,68,0.03))'}; border: 1px solid ${connected ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.25)'};">
           <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
              <div style="width: 44px; height: 44px; border-radius: var(--radius-md); background: ${connected ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'}; color: ${connected ? 'var(--ok, #22c55e)' : 'var(--danger, #ef4444)'}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                 ${renderIcon(connected ? "coreblow" : "alertTriangle", "24px")}
              </div>
              <div style="flex: 1; min-width: 200px;">
                 <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="font-weight: 700; font-size: 16px;">${connected ? t("overview.status.coreblowOnline") : t("overview.status.notConnected")}</div>
                    <span style="font-size: 11px; padding: 2px 8px; border-radius: 12px; background: var(--accent-subtle); color: var(--accent); font-weight: 700; font-family: var(--mono);">v2.1.2</span>
                 </div>
                 <div style="font-size: 12px; color: var(--muted); margin-top: 2px;">${connected ? `${t("overview.status.connected")} ${this.app.settings.gatewayUrl}` : t("chat.connectToChat")}</div>
              </div>

              <!-- Live E-Stop Status Indicator / Toggle -->
              <div style="display: flex; align-items: center; gap: 8px;">
                 <button class="btn" style="background: ${this.estopPaused ? 'rgba(239,68,68,0.2)' : 'var(--bg-elevated)'}; border: 1px solid ${this.estopPaused ? 'var(--destructive, #ef4444)' : 'var(--border)'}; color: ${this.estopPaused ? 'var(--destructive, #ef4444)' : 'var(--foreground)'}; padding: 6px 12px; border-radius: var(--radius-sm); font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;"
                         ?disabled=${this.estopLoading || !connected}
                         title=${this.estopPaused ? (this.estopReason || "Execution paused via E-Stop") : "All autonomous execution armed"}
                         @click=${() => void this.toggleEstop()}>
                    <span style="width: 8px; height: 8px; border-radius: 50%; background: ${this.estopPaused ? 'var(--destructive, #ef4444)' : 'var(--success, #22c55e)'}; display: inline-block;"></span>
                    <span>${this.estopPaused ? "E-Stop: ACTIVE" : "E-Stop: Armed"}</span>
                 </button>
              </div>

              ${approvalCount > 0 ? html`
                 <div style="background: var(--warning, #f59e0b); color: #000; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 700;">${approvalCount} pending approval</div>
              ` : ""}
           </div>

           <!-- Runtime Posture Chips -->
           <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border-hairline); display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
              <span style="font-size: 11px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-right: 4px;">Posture:</span>
              <span style="font-size: 11px; padding: 2px 8px; border-radius: var(--radius-sm); background: var(--surface-flat-muted); border: 1px solid var(--border-hairline); color: var(--foreground); display: inline-flex; align-items: center; gap: 5px; font-family: var(--mono);">
                 <span style="color: var(--accent, #6366f1);">●</span> ${this.app.settings.connectionMode === "remote" ? "Remote Node" : this.app.settings.connectionMode === "ssh" ? "SSH Tunnel" : "Local Gateway"}
              </span>
              <span style="font-size: 11px; padding: 2px 8px; border-radius: var(--radius-sm); background: var(--surface-flat-muted); border: 1px solid var(--border-hairline); color: var(--foreground); display: inline-flex; align-items: center; gap: 5px; font-family: var(--mono);">
                 <span style="color: var(--ok, #22c55e);">●</span> SQLite WAL + FTS5
              </span>
              <span style="font-size: 11px; padding: 2px 8px; border-radius: var(--radius-sm); background: var(--surface-flat-muted); border: 1px solid var(--border-hairline); color: var(--foreground); display: inline-flex; align-items: center; gap: 5px; font-family: var(--mono);">
                 <span style="color: var(--accent, #6366f1);">●</span> dmScope: per-channel-peer
              </span>
              <span style="font-size: 11px; padding: 2px 8px; border-radius: var(--radius-sm); background: var(--surface-flat-muted); border: 1px solid var(--border-hairline); color: var(--foreground); display: inline-flex; align-items: center; gap: 5px; font-family: var(--mono);">
                 <span style="color: var(--ok, #22c55e);">●</span> AST Skill Guard
              </span>
              <span style="font-size: 11px; padding: 2px 8px; border-radius: var(--radius-sm); background: var(--surface-flat-muted); border: 1px solid var(--border-hairline); color: var(--foreground); display: inline-flex; align-items: center; gap: 5px; font-family: var(--mono);">
                 <span style="color: var(--accent, #6366f1);">●</span> MCP Sovereign Bridge
              </span>
           </div>
        </div>

        <!-- Stats Grid -->
        <div style="display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
           ${this.renderStatCard("activity", t("common.status"), connected ? t("overview.status.connected") : t("common.offline"))}
           ${this.renderStatCard("fileText", t("tabs.sessions"), String(this.app.sessionsCount))}
           ${this.renderStatCard("users", t("tabs.peers"), String(this.app.presenceCount))}
           ${this.renderStatCard("bot", t("common.models"), String(modelCount))}
           ${this.renderStatCard("messageSquare", t("chat.activeChat"), sessionKey ? sessionKey.slice(0, 12) + "…" : t("common.none"))}
           ${this.renderStatCard("scrollText", t("common.events"), String(this.app.eventLog.length))}
        </div>

        <!-- Quick Actions & Preferences -->
        <div style="display: grid; gap: 16px; grid-template-columns: 1fr;">
           <div class="card">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                 <div class="card-title" style="display: flex; align-items: center; gap: 8px; margin: 0;">
                    ${renderIcon("zap", "16px", "color: var(--accent);")}
                    <span>${t("common.actions")}</span>
                 </div>
                 <label style="display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted);">
                    <span>${t("overview.access.language")}</span>
                    <select
                           style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 5px 10px; border-radius: var(--radius-sm); color: var(--foreground); font-size: 12px;"
                           .value=${currentLocale}
                           @input=${(e: Event) => this.handleLocaleChange(e)}
                           @change=${(e: Event) => this.handleLocaleChange(e)}>
                       ${SUPPORTED_LOCALES.map((locale) => html`
                         <option value=${locale} ?selected=${currentLocale === locale}>
                           ${t(`languages.${locale}`)}
                         </option>
                       `)}
                    </select>
                 </label>
              </div>
              <div style="margin-top: 12px; display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
                 <button class="btn" style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); display: flex; align-items: center; gap: 10px; text-align: left; transition: border-color 0.15s;"
                  @click=${() => this.app.setTab("chat" as any)}>
                    ${renderIcon("messageSquare", "15px", "color: var(--accent);")}
                    <span>${t("chat.openInChat")}</span>
                 </button>
                 <button class="btn" style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); display: flex; align-items: center; gap: 10px; text-align: left; transition: border-color 0.15s;"
                  @click=${() => this.app.setTab("sessions" as any)}>
                    ${renderIcon("fileText", "15px", "color: var(--accent);")}
                    <span>${t("tabs.sessions")}</span>
                 </button>
                 <button class="btn" style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); display: flex; align-items: center; gap: 10px; text-align: left; transition: border-color 0.15s;"
                  @click=${() => this.app.setTab("cron" as any)}>
                    ${renderIcon("clock", "15px", "color: var(--accent);")}
                    <span>${t("cron.title")} (24/7 Cron)</span>
                 </button>
                 <button class="btn" style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); display: flex; align-items: center; gap: 10px; text-align: left; transition: border-color 0.15s;"
                  @click=${() => this.app.setTab("skills" as any)}>
                    ${renderIcon("zap", "15px", "color: var(--accent);")}
                    <span>${t("skills.title")} (AST Guard)</span>
                 </button>
                 <button class="btn" style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); display: flex; align-items: center; gap: 10px; text-align: left; transition: border-color 0.15s;"
                  @click=${() => this.app.setTab("coreHub" as any)}>
                    ${renderIcon("package", "15px", "color: var(--accent);")}
                    <span>CoreHub &amp; Channels</span>
                 </button>
                 <button class="btn" style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); display: flex; align-items: center; gap: 10px; text-align: left; transition: border-color 0.15s;"
                  @click=${() => this.app.setTab("config" as any)}>
                    ${renderIcon("settings", "15px", "color: var(--accent);")}
                    <span>${t("config.title")}</span>
                 </button>
                 <button class="btn" style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); display: flex; align-items: center; gap: 10px; text-align: left; transition: border-color 0.15s;"
                  @click=${() => this.app.setTab("debug" as any)}>
                    ${renderIcon("bug", "15px", "color: var(--accent);")}
                    <span>${t("debug.title")}</span>
                 </button>
                 <button class="btn" style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); display: flex; align-items: center; gap: 10px; text-align: left; transition: border-color 0.15s;"
                  @click=${() => this.app.setTab("logs" as any)}>
                    ${renderIcon("scrollText", "15px", "color: var(--accent);")}
                    <span>${t("tabs.logs") || "Logs"} (Diagnostics)</span>
                 </button>
              </div>
           </div>
        </div>

        <!-- Event Log -->
        <div class="card">
           <div style="display: flex; align-items: center; gap: 8px;">
              <div class="card-title" style="flex: 1; display: flex; align-items: center; gap: 8px;">
                 ${renderIcon("scrollText", "16px", "color: var(--muted);")}
                 <span>${t("common.events")}</span>
              </div>
              <span style="font-size: 11px; color: var(--muted);">${this.app.eventLog.length} entries</span>
           </div>
           <div style="margin-top: 12px; background: var(--bg-elevated); border-radius: var(--radius-sm); max-height: 300px; overflow-y: auto;">
              ${this.app.eventLog.length === 0 ? html`<div style="padding: 24px; text-align: center; color: var(--muted); font-size: 12px;">${t("common.none")}</div>` : ""}
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

  private renderStatCard(icon: IconName, label: string, value: string) {
     return html`
        <div class="card" style="padding: 16px; display: flex; align-items: center; gap: 14px;">
           <div style="width: 36px; height: 36px; border-radius: var(--radius-sm); background: var(--accent-subtle); color: var(--accent); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              ${renderIcon(icon, "18px")}
           </div>
           <div>
              <div style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500;">${label}</div>
              <div style="font-size: 16px; font-weight: 700; margin-top: 2px;">${value}</div>
           </div>
        </div>
     `;
  }
}
