import { html } from "lit";
import { CoreBlowApp } from "./app.ts";
import { icons, renderIcon } from "./icons.ts";
import { TAB_GROUPS, iconForTab, titleForTab } from "./navigation.ts";
import "./views/overview.ts";
import "./views/chat.ts";
import "./views/sessions.ts";
import "./views/config.ts";
import "./views/agents.ts";
import "./views/debug.ts";
import "./views/usage.ts";
import "./views/logs.ts";
import "./views/skills.ts";
import "./views/corehub.ts";
import "./views/command-palette.ts";
import "./views/cron.ts";
import "./views/channels.ts";
import "./views/models.ts";
import "./views/mcp.ts";

export function renderApp(app: CoreBlowApp) {
  return html`
    <div class="shell ${app.navDrawerOpen ? "shell--nav-open" : ""}">
      <!-- Topbar -->
      <header class="topbar">
        <div class="topnav-shell">
          <div class="topnav-shell__content">
            <div class="dashboard-header">
              <div class="dashboard-header__breadcrumb">
                <span class="dashboard-header__breadcrumb-current">${titleForTab(app.tab)}</span>
              </div>
            </div>
          </div>

          <div class="topnav-shell__actions" style="display: flex; align-items: center; gap: 8px;">
            <!-- Command Palette Trigger -->
            <div class="topbar-status">
              <button
                type="button"
                class="pill"
                style="cursor: pointer; height: 30px; padding: 0 10px; display: inline-flex; align-items: center; gap: 6px; background: var(--surface-flat-muted); border: 1px solid var(--border-hairline); color: var(--muted); font-size: 11px; white-space: nowrap;"
                title="Command Palette (⌘K)"
                @click=${() => {
                  const palette = document.querySelector("coreblow-command-palette") as {
                    toggle?: () => void;
                  } | null;
                  if (palette?.toggle) {
                    palette.toggle();
                  } else {
                    document.dispatchEvent(
                      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
                    );
                  }
                }}
              >
                ${renderIcon("search", "12px")}
                <span style="font-family: var(--mono); opacity: 0.85;">⌘K</span>
              </button>
            </div>
            <!-- Light/Dark Mode Toggle -->
            <div class="topbar-status">
              <button
                class="pill"
                style="cursor: pointer; width: 30px; height: 30px; padding: 0; display: inline-flex; align-items: center; justify-content: center; background: var(--surface-flat-muted); border: 1px solid var(--border-hairline); color: var(--text);"
                title="Toggle Light / Dark Mode"
                @click=${() => app.toggleThemeMode()}
              >
                ${renderIcon(
                  document.documentElement.getAttribute("data-theme-mode") === "light"
                    ? "moon"
                    : "sun",
                  "14px",
                )}
              </button>
            </div>
            <!-- Theme Family Switcher -->
            <div class="topbar-status">
              <button
                class="pill"
                style="cursor: pointer; height: 30px; padding: 0 11px; display: inline-flex; align-items: center; gap: 6px; background: var(--surface-flat-muted); border: 1px solid var(--border-hairline); font-size: 12px; white-space: nowrap;"
                title="Switch CoreBlow Theme (${app.theme})"
                @click=${() => {
                  app.setTheme(
                    app.theme === "core"
                      ? "obsidian"
                      : app.theme === "obsidian"
                        ? "coredash"
                        : "core",
                  );
                }}
              >
                ${renderIcon("palette", "13px", "color: var(--accent);")}
                <span style="text-transform: capitalize; color: var(--text); font-weight: 500;"
                  >${app.theme}</span
                >
              </button>
            </div>
            <!-- Status Pill -->
            <div class="topbar-status">
              <div
                class="pill"
                style="height: 30px; padding: 0 11px; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;"
              >
                <div class="statusDot ${app.connected ? "stat-ok" : "stat-error"}"></div>
                ${app.connected ? "Online" : "Offline"}
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- Navigation Sidebar -->
      <nav class="shell-nav">
        <div class="sidebar">
          <div class="sidebar-shell">
            <div class="sidebar-shell__header">
              <div class="sidebar-brand">
                <div
                  class="sidebar-brand__logo"
                  style="background: var(--accent-subtle); border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent); display:flex; align-items:center; justify-content:center; color: var(--accent); border-radius: var(--radius-sm);"
                >
                  ${renderIcon("coreblow", "18px", "color: var(--accent);")}
                </div>
                <div class="sidebar-brand__copy">
                  <div class="sidebar-brand__eyebrow">CoreBlow OS</div>
                  <div class="sidebar-brand__title">Control Plane</div>
                </div>
              </div>
            </div>

            <div class="sidebar-shell__body">
              <div class="sidebar-nav" style="display: flex; flex-direction: column; gap: 4px;">
                ${TAB_GROUPS.flatMap((group) => group.tabs).map(
                  (tab: any) => html`
                    <button
                      type="button"
                      class="nav-item ${app.tab === tab ? "nav-item--active active" : ""}"
                      style="width: 100%; text-align: left; font: inherit;"
                      @click=${() => app.setTab(tab)}
                    >
                      <div class="nav-item__icon">
                        ${icons[iconForTab(tab) as keyof typeof icons]}
                      </div>
                      <div class="nav-item__text">${titleForTab(tab)}</div>
                    </button>
                  `,
                )}
              </div>
            </div>

            <div
              class="sidebar-shell__footer"
              style="padding: 10px 0 0; border-top: 1px solid var(--border-hairline); display: flex; flex-direction: column; gap: 8px;"
            >
              <!-- Status line: Live dot + Online/Offline + sessions count -->
              <div
                style="display: flex; align-items: center; justify-content: space-between; padding: 0 4px; font-size: 11px;"
              >
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span
                    style="width: 7px; height: 7px; border-radius: 50%; background: ${app.connected
                      ? "var(--ok, #22c55e)"
                      : "var(--danger, #f87171)"}; box-shadow: 0 0 0 3px ${app.connected
                      ? "rgba(34, 197, 94, 0.15)"
                      : "rgba(239, 68, 68, 0.15)"};"
                  ></span>
                  <span
                    style="font-weight: 600; color: ${app.connected
                      ? "var(--text-strong)"
                      : "var(--muted)"};"
                  >
                    Gateway: ${app.connected ? "Online" : "Offline"}
                  </span>
                </div>
                ${app.sessionsCount > 0
                  ? html`<span
                      style="font-size: 10px; font-family: var(--mono); color: var(--muted);"
                      >${app.sessionsCount} active</span
                    >`
                  : ""}
              </div>

              <!-- Status Toast/Feedback text if active -->
              ${app.footerStatusText
                ? html`
                    <div
                      style="font-size: 10px; font-weight: 600; color: var(--accent); padding: 2px 6px; background: var(--surface-flat-muted); border-radius: var(--radius-sm); text-align: center;"
                    >
                      ${app.footerStatusText}
                    </div>
                  `
                : ""}

              <!-- Action buttons: Restart Gateway & Check Update -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                <button
                  type="button"
                  style="display: flex; align-items: center; justify-content: center; gap: 4px; background: var(--card); border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); padding: 5px 6px; font-size: 10px; font-weight: 500; color: ${app.connected
                    ? "var(--text)"
                    : "var(--muted)"}; cursor: ${app.connected && !app.gatewayRestarting
                    ? "pointer"
                    : "default"}; opacity: ${app.connected ? "1" : "0.6"}; outline: none;"
                  title=${app.connected ? "Restart Gateway process" : "Gateway is offline"}
                  ?disabled=${!app.connected || app.gatewayRestarting}
                  @click=${() => app.restartGateway()}
                >
                  <span style="width: 10px; height: 10px; display: inline-flex;"
                    >${renderIcon("refresh")}</span
                  >
                  ${app.gatewayRestarting ? "Restarting..." : "Restart"}
                </button>

                <button
                  type="button"
                  style="display: flex; align-items: center; justify-content: center; gap: 4px; background: var(--card); border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); padding: 5px 6px; font-size: 10px; font-weight: 500; color: ${app.connected
                    ? "var(--text)"
                    : "var(--muted)"}; cursor: ${app.connected && !app.updateChecking
                    ? "pointer"
                    : "default"}; opacity: ${app.connected ? "1" : "0.6"}; outline: none;"
                  title=${app.connected ? "Check for CoreBlow updates" : "Gateway is offline"}
                  ?disabled=${!app.connected || app.updateChecking}
                  @click=${() => app.checkUpdate()}
                >
                  <span style="width: 10px; height: 10px; display: inline-flex;"
                    >${renderIcon("download")}</span
                  >
                  ${app.updateChecking ? "Checking..." : "Update"}
                </button>
              </div>

              <!-- Bottom utility row: version badge + Docs link -->
              <div
                style="display: flex; align-items: center; justify-content: space-between; padding: 2px 4px 0; font-size: 11px;"
              >
                <span
                  style="font-family: var(--mono); font-weight: 600; color: var(--muted); font-size: 10px; letter-spacing: 0.02em;"
                >
                  v2.3.0
                </span>
                <a
                  href="https://docs.coreblow.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style="display: inline-flex; align-items: center; gap: 3px; font-size: 10px; color: var(--accent); text-decoration: none; font-weight: 500;"
                >
                  Docs ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <!-- Main Content Area -->
      <main class="content" style="padding: var(--shell-pad); overflow-y: auto;">
        ${renderCurrentTab(app)}
      </main>
    </div>
    <coreblow-command-palette .app=${app}></coreblow-command-palette>
  `;
}

function renderCurrentTab(app: CoreBlowApp) {
  if (app.tab === "overview") {
    return html`<coreblow-overview-view .app=${app}></coreblow-overview-view>`;
  }
  if (app.tab === "chat") {
    return html`<coreblow-chat-view
      .app=${app}
      style="display:flex; flex-direction:column; height: 100%;"
    ></coreblow-chat-view>`;
  }
  if (app.tab === "sessions") {
    return html`<coreblow-sessions-view .app=${app}></coreblow-sessions-view>`;
  }
  if (app.tab === "channels") {
    return html`<coreblow-channels-view .app=${app}></coreblow-channels-view>`;
  }
  if (app.tab === "models") {
    return html`<coreblow-models-view .app=${app}></coreblow-models-view>`;
  }
  if (app.tab === "mcp") {
    return html`<coreblow-mcp-view .app=${app}></coreblow-mcp-view>`;
  }
  if (app.tab === "config") {
    return html`<coreblow-config-view .app=${app}></coreblow-config-view>`;
  }
  if (app.tab === "aiAgents") {
    return html`<coreblow-agents-view .app=${app}></coreblow-agents-view>`;
  }
  if (app.tab === "debug") {
    return html`<coreblow-debug-view .app=${app}></coreblow-debug-view>`;
  }
  if (app.tab === "usage") {
    return html`<coreblow-usage-view .app=${app}></coreblow-usage-view>`;
  }
  if (app.tab === "logs") {
    return html`<coreblow-logs-view .app=${app}></coreblow-logs-view>`;
  }
  if (app.tab === "skills") {
    return html`<coreblow-skills-view .app=${app}></coreblow-skills-view>`;
  }
  if (app.tab === "cron") {
    return html`<coreblow-cron-view .app=${app}></coreblow-cron-view>`;
  }
  if (app.tab === "coreHub") {
    return html`<coreblow-corehub-view .app=${app}></coreblow-corehub-view>`;
  }
  return html`
    <div class="card">
      <div class="card-title">Under Construction</div>
      <div class="card-sub">The ${titleForTab(app.tab)} page is being built.</div>
      <p style="margin-top: 16px; color: var(--muted)">
        This feature will be fully implemented in a subsequent phase.
      </p>
    </div>
  `;
}
