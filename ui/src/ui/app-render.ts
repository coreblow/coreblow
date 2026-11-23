import { html } from "lit";
import { CoreBlowApp } from "./app.ts";
import { TAB_GROUPS, iconForTab, titleForTab } from "./navigation.ts";
import { icons, renderIcon } from "./icons.ts";
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
               <button class="pill" style="cursor: pointer; height: 30px; padding: 0 10px; display: inline-flex; align-items: center; gap: 6px; background: var(--surface-flat-muted); border: 1px solid var(--border-hairline); color: var(--muted); font-size: 11px; white-space: nowrap;"
                       title="Command Palette (⌘K)"
                       @click=${() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}>
                  ${renderIcon("search", "12px")}
                  <span style="font-family: var(--mono); opacity: 0.85;">⌘K</span>
               </button>
            </div>
            <!-- Light/Dark Mode Toggle -->
            <div class="topbar-status">
               <button class="pill" style="cursor: pointer; width: 30px; height: 30px; padding: 0; display: inline-flex; align-items: center; justify-content: center; background: var(--surface-flat-muted); border: 1px solid var(--border-hairline); color: var(--text);"
                       title="Toggle Light / Dark Mode"
                       @click=${() => app.toggleThemeMode()}>
                  ${renderIcon(document.documentElement.getAttribute("data-theme-mode") === "light" ? "moon" : "sun", "14px")}
               </button>
            </div>
            <!-- Theme Family Switcher -->
            <div class="topbar-status">
               <button class="pill" style="cursor: pointer; height: 30px; padding: 0 11px; display: inline-flex; align-items: center; gap: 6px; background: var(--surface-flat-muted); border: 1px solid var(--border-hairline); font-size: 12px; white-space: nowrap;"
                       title="Switch CoreBlow Theme (${app.theme})"
                       @click=${() => {
                         app.setTheme(app.theme === "core" ? "obsidian" : app.theme === "obsidian" ? "coredash" : "core");
                       }}>
                  ${renderIcon("palette", "13px", "color: var(--accent);")}
                  <span style="text-transform: capitalize; color: var(--text); font-weight: 500;">${app.theme}</span>
               </button>
            </div>
            <!-- Status Pill -->
            <div class="topbar-status">
               <div class="pill" style="height: 30px; padding: 0 11px; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;">
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
                   <div class="sidebar-brand__logo" style="background: var(--accent-subtle); border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent); display:flex; align-items:center; justify-content:center; color: var(--accent); border-radius: var(--radius-sm);">
                      ${renderIcon("coreblow", "18px", "color: var(--accent);")}
                   </div>
                   <div class="sidebar-brand__copy">
                      <div class="sidebar-brand__eyebrow">CoreBlow OS</div>
                      <div class="sidebar-brand__title">Control Plane</div>
                   </div>
                </div>
             </div>

             <div class="sidebar-shell__body">
                <div class="sidebar-nav">
                  ${TAB_GROUPS.map(group => html`
                    <div class="nav-section">
                      <button class="nav-section__label">
                        <span class="nav-section__label-text">${group.label}</span>
                      </button>
                      <div class="nav-section__items">
                        ${group.tabs.map((tab: any) => html`
                          <a href="javascript:void(0)"
                             class="nav-item ${app.tab === tab ? "nav-item--active active" : ""}"
                             @click=${() => app.setTab(tab)}>
                            <div class="nav-item__icon">${icons[iconForTab(tab) as keyof typeof icons]}</div>
                            <div class="nav-item__text">${titleForTab(tab)}</div>
                          </a>
                        `)}
                      </div>
                    </div>
                  `)}
                </div>
             </div>

             <div class="sidebar-shell__footer">
                <div class="sidebar-version">
                   <div class="sidebar-version__label">v2.1.2</div>
                   <div class="sidebar-version__status ${app.connected ? "sidebar-connection-status--online" : "sidebar-connection-status--offline"}"></div>
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
     return html`<coreblow-chat-view .app=${app} style="display:flex; flex-direction:column; height: 100%;"></coreblow-chat-view>`;
  }
  if (app.tab === "sessions") {
     return html`<coreblow-sessions-view .app=${app}></coreblow-sessions-view>`;
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
       <p style="margin-top: 16px; color: var(--muted)">This feature will be fully implemented in a subsequent phase.</p>
     </div>
  `;
}
