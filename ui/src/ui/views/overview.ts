import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  i18n,
  I18nController,
  isSupportedLocale,
  SUPPORTED_LOCALES,
  t,
} from "../../i18n/index.ts";
import type { CoreBlowApp } from "../app.ts";
import { renderIcon, type IconName } from "../icons.ts";
import { getDefaultGatewayUrl } from "../storage.ts";

@customElement("coreblow-overview-view")
export class OverviewView extends LitElement {
  private i18nController = new I18nController(this);
  @property({ attribute: false }) app!: CoreBlowApp;

  createRenderRoot() {
    return this;
  }

  private handleLocaleChange(event: Event) {
    const locale = (event.target as HTMLSelectElement).value;
    if (!isSupportedLocale(locale)) {
      return;
    }
    void i18n.setLocale(locale);
    this.app.applySettings({ ...this.app.settings, locale });
  }

  private handleSetDefaultUrl() {
    const defaultUrl = getDefaultGatewayUrl();
    this.app.applySettings({ ...this.app.settings, gatewayUrl: defaultUrl });
    this.app.gateway.reconnect();
  }

  render() {
    const connected = this.app.connected;
    const modelCount = this.app.chatModelCatalog.length;
    const sessionKey = this.app.chat.sessionKey;
    const approvalCount = this.app.approvalQueue.length;
    const currentLocale = isSupportedLocale(this.app.settings.locale)
      ? this.app.settings.locale
      : "en";

    return html`
      <div style="display: flex; flex-direction: column; gap: 20px; max-width: 1400px; margin: 0 auto; width: 100%;">

        <!-- Hero System Status Card -->
        <div class="card" style="padding: 24px; position: relative; overflow: hidden; background: linear-gradient(135deg, ${connected ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)'} 0%, rgba(20,24,33,0.95) 100%); border: 1px solid ${connected ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}; box-shadow: 0 4px 20px rgba(0,0,0,0.25);">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 16px;">
              <div style="width: 52px; height: 52px; border-radius: 12px; background: ${connected ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}; color: ${connected ? 'var(--ok, #22c55e)' : 'var(--danger, #ef4444)'}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 0 24px ${connected ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'};">
                ${renderIcon(connected ? "coreblow" : "alertTriangle", "28px")}
              </div>
              <div>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <h2 style="margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.01em; color: var(--text-strong);">
                    ${connected ? t("overview.status.coreblowOnline") : t("overview.status.notConnected")}
                  </h2>
                  <span style="display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; background: ${connected ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'}; color: ${connected ? 'var(--ok, #22c55e)' : 'var(--danger, #ef4444)'};">
                    <span style="width: 6px; height: 6px; border-radius: 50%; background: ${connected ? 'var(--ok, #22c55e)' : 'var(--danger, #ef4444)'}; display: inline-block;"></span>
                    ${connected ? "LIVE" : "OFFLINE"}
                  </span>
                </div>
                <div style="font-size: 13px; color: var(--muted); margin-top: 4px; font-family: var(--mono); word-break: break-all;">
                  ${connected ? `Connected: ${this.app.settings.gatewayUrl}` : `Target: ${this.app.settings.gatewayUrl}`}
                </div>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 10px;">
              ${approvalCount > 0 ? html`
                <div style="background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.3); color: var(--warn, #f59e0b); padding: 6px 14px; border-radius: var(--radius-sm); font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                  ${renderIcon("lock", "14px")}
                  <span>${approvalCount} Pending Approvals</span>
                </div>
              ` : ""}

              ${!connected ? html`
                <button class="btn" style="background: var(--accent); color: var(--accent-foreground, #fff); border: none; padding: 8px 16px; border-radius: var(--radius-sm); cursor: pointer; font-weight: 600; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 10px var(--accent-glow);"
                        @click=${() => this.handleSetDefaultUrl()}>
                  ${renderIcon("refresh", "13px")}
                  <span>Auto-Connect (Current Origin)</span>
                </button>
              ` : html`
                <button class="btn" style="background: var(--bg-elevated); border: 1px solid var(--border); color: var(--text); padding: 8px 14px; border-radius: var(--radius-sm); cursor: pointer; font-size: 12px; display: inline-flex; align-items: center; gap: 6px;"
                        @click=${() => this.app.gateway.reconnect()}>
                  ${renderIcon("refresh", "13px")}
                  <span>Reconnect</span>
                </button>
              `}
            </div>
          </div>
        </div>

        <!-- Metrics Cards Grid -->
        <div style="display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
          ${this.renderStatCard("activity", "Gateway Status", connected ? "Active" : "Offline", connected ? "var(--ok, #22c55e)" : "var(--danger, #ef4444)")}
          ${this.renderStatCard("fileText", t("tabs.sessions"), String(this.app.sessionsCount), "var(--accent)")}
          ${this.renderStatCard("users", t("tabs.peers"), String(this.app.presenceCount), "#38bdf8")}
          ${this.renderStatCard("bot", t("common.models"), String(modelCount), "#a855f7")}
          ${this.renderStatCard("messageSquare", t("chat.activeChat"), sessionKey ? sessionKey.slice(0, 10) + "…" : t("common.none"), "#f59e0b")}
          ${this.renderStatCard("scrollText", t("common.events"), String(this.app.eventLog.length), "var(--muted)")}
        </div>

        <!-- Dual Column System Management -->
        <div style="display: grid; gap: 20px; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); align-items: start;">

          <!-- Gateway Connection Console -->
          <div class="card" style="padding: 20px;">
            <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 14px; border-bottom: 1px solid var(--border);">
              <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; color: var(--text-strong);">
                ${renderIcon("globe", "16px", "color: var(--accent);")}
                <span>Gateway Connection</span>
              </div>
              <span style="font-size: 11px; color: var(--muted); font-family: var(--mono);">${connected ? "WEBSOCKET READY" : "DISCONNECTED"}</span>
            </div>

            <div style="margin-top: 16px; display: grid; gap: 14px;">
              <label style="display: flex; flex-direction: column; gap: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 12px; font-weight: 500; color: var(--text);">${t("overview.access.wsUrl")}</span>
                  <a href="javascript:void(0)"
                     style="font-size: 11px; color: var(--accent); text-decoration: none;"
                     @click=${() => this.handleSetDefaultUrl()}>Use Host Origin</a>
                </div>
                <input style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 10px 12px; border-radius: var(--radius-sm); color: var(--text-strong); font-family: var(--mono); font-size: 13px; width: 100%; box-sizing: border-box;"
                       .value=${this.app.settings.gatewayUrl}
                       @input=${(e: Event) => this.app.applySettings({...this.app.settings, gatewayUrl: (e.target as HTMLInputElement).value})}/>
              </label>

              <label style="display: flex; flex-direction: column; gap: 6px;">
                <span style="font-size: 12px; font-weight: 500; color: var(--text);">${t("overview.access.token")}</span>
                <input type="password"
                       placeholder="Optional authentication token"
                       style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 10px 12px; border-radius: var(--radius-sm); color: var(--text-strong); font-family: var(--mono); font-size: 13px; width: 100%; box-sizing: border-box;"
                       .value=${this.app.settings.token}
                       @input=${(e: Event) => this.app.applySettings({...this.app.settings, token: (e.target as HTMLInputElement).value})}/>
              </label>

              <label style="display: flex; flex-direction: column; gap: 6px;">
                <span style="font-size: 12px; font-weight: 500; color: var(--text);">${t("overview.access.language")}</span>
                <select style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 10px 12px; border-radius: var(--radius-sm); color: var(--text-strong); font-size: 13px; width: 100%; box-sizing: border-box; cursor: pointer;"
                        .value=${currentLocale}
                        @change=${(e: Event) => this.handleLocaleChange(e)}>
                  ${SUPPORTED_LOCALES.map((locale) => html`
                    <option value=${locale} ?selected=${currentLocale === locale}>
                      ${t(`languages.${locale}`)}
                    </option>
                  `)}
                </select>
              </label>

              <div style="display: flex; gap: 10px; margin-top: 6px;">
                <button class="btn" style="flex: 1; background: var(--accent); color: var(--accent-foreground, #fff); border: none; padding: 12px 18px; border-radius: var(--radius-sm); cursor: pointer; font-weight: 600; font-size: 13px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 2px 10px var(--accent-glow);"
                        @click=${() => this.app.gateway.reconnect()}>
                  ${renderIcon(connected ? "refresh" : "zap", "14px")}
                  <span>${connected ? t("overview.status.reconnect") : t("common.connect")}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Command Launchpad -->
          <div class="card" style="padding: 20px;">
            <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 14px; border-bottom: 1px solid var(--border);">
              <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; color: var(--text-strong);">
                ${renderIcon("spark", "16px", "color: var(--accent);")}
                <span>CoreBlow Launchpad</span>
              </div>
              <span style="font-size: 11px; color: var(--muted);">WORKSPACE</span>
            </div>

            <div style="margin-top: 14px; display: grid; gap: 10px;">
              ${this.renderActionCard(
                "messageSquare",
                t("chat.openInChat"),
                "Launch interactive pair-programming and agent chats",
                () => this.app.setTab("chat" as any)
              )}
              ${this.renderActionCard(
                "fileText",
                t("tabs.sessions"),
                "Inspect session state, memory context, and active runs",
                () => this.app.setTab("sessions" as any)
              )}
              ${this.renderActionCard(
                "settings",
                t("config.title"),
                "Configure providers, channel hooks, and routing",
                () => this.app.setTab("config" as any)
              )}
              ${this.renderActionCard(
                "package",
                "CoreHub Marketplace",
                "Discover and install agent skills, plugins, and tools",
                () => this.app.setTab("corehub" as any)
              )}
              ${this.renderActionCard(
                "bug",
                t("debug.title"),
                "Gateway RPC inspectors, logs, and diagnostic events",
                () => this.app.setTab("debug" as any)
              )}
            </div>
          </div>

        </div>

        <!-- Telemetry Log -->
        <div class="card" style="padding: 20px;">
          <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid var(--border);">
            <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; color: var(--text-strong);">
              ${renderIcon("scrollText", "16px", "color: var(--muted);")}
              <span>Live Gateway Telemetry</span>
            </div>
            <span style="font-size: 11px; font-family: var(--mono); color: var(--muted);">${this.app.eventLog.length} events logged</span>
          </div>

          <div style="margin-top: 14px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-sm); max-height: 260px; overflow-y: auto; font-family: var(--mono); font-size: 12px;">
            ${this.app.eventLog.length === 0 ? html`
              <div style="padding: 28px; text-align: center; color: var(--muted); font-size: 12px;">
                No telemetry recorded yet.
              </div>
            ` : ""}
            ${this.app.eventLog.slice(0, 40).map(e => html`
              <div style="padding: 8px 14px; border-bottom: 1px solid var(--border); display: flex; gap: 12px; align-items: flex-start;">
                <span style="color: var(--muted); font-size: 11px; min-width: 75px; flex-shrink: 0;">
                  ${new Date(e.ts).toLocaleTimeString()}
                </span>
                <span style="color: var(--text-strong); word-break: break-all; flex: 1;">
                  ${e.raw}
                </span>
              </div>
            `)}
          </div>
        </div>

      </div>
    `;
  }

  private renderStatCard(icon: IconName, label: string, value: string, accentColor = "var(--accent)") {
    return html`
      <div class="card" style="padding: 16px 18px; display: flex; align-items: center; gap: 14px; transition: transform 0.15s ease, border-color 0.15s ease; border: 1px solid var(--border); background: var(--card);">
        <div style="width: 40px; height: 40px; border-radius: var(--radius-sm); background: color-mix(in srgb, ${accentColor} 12%, transparent); color: ${accentColor}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          ${renderIcon(icon, "20px")}
        </div>
        <div style="min-width: 0; flex: 1;">
          <div style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${label}
          </div>
          <div style="font-size: 18px; font-weight: 700; margin-top: 2px; color: var(--text-strong); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${value}
          </div>
        </div>
      </div>
    `;
  }

  private renderActionCard(icon: IconName, title: string, subtitle: string, onClick: () => void) {
    return html`
      <button class="btn"
              style="width: 100%; background: var(--bg-elevated); border: 1px solid var(--border); padding: 12px 14px; border-radius: var(--radius-sm); cursor: pointer; color: var(--text-strong); display: flex; align-items: center; gap: 12px; text-align: left; transition: all 0.15s ease;"
              @click=${onClick}>
        <div style="width: 32px; height: 32px; border-radius: var(--radius-sm); background: var(--accent-subtle); color: var(--accent); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          ${renderIcon(icon, "16px")}
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 600; font-size: 13px; color: var(--text-strong);">${title}</div>
          <div style="font-size: 11px; color: var(--muted); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${subtitle}</div>
        </div>
        <div style="color: var(--muted); display: flex; align-items: center;">
          ${renderIcon("chevronRight", "14px")}
        </div>
      </button>
    `;
  }
}
