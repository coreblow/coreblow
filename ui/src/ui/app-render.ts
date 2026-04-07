import { html } from "lit";
import { CoreBlowApp } from "./app.ts";
import { TAB_GROUPS, iconForTab, titleForTab } from "./navigation.ts";
import { icons } from "./icons.ts";
import "./views/overview.ts";
import "./views/chat.ts";
import "./views/sessions.ts";
import "./views/config.ts";
import "./views/agents.ts";
import "./views/debug.ts";
import "./views/usage.ts";
import "./views/logs.ts";
import "./views/skills.ts";
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
          
          <div class="topnav-shell__actions">
            <!-- Theme toggle -->
            <div class="topbar-status">
               <div class="theme-orb__trigger pill" style="cursor: pointer" @click=${() => {
                 app.setTheme(app.theme === "core" ? "knot" : app.theme === "knot" ? "dash" : "core");
               }}>
                  🎨
               </div>
            </div>
            <!-- Status Pill -->
            <div class="topbar-status">
               <div class="pill">
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
                   <div class="sidebar-brand__logo" style="background: var(--accent); display:flex; align-items:center; justify-content:center; color:white; font-weight:bold;">CB</div>
                   <div class="sidebar-brand__copy">
                      <div class="sidebar-brand__eyebrow">Gateway</div>
                      <div class="sidebar-brand__title">CoreBlow</div>
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
                   <div class="sidebar-version__label">v1.0.0</div>
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
   return html`
     <div class="card">
       <div class="card-title">Under Construction</div>
       <div class="card-sub">The ${titleForTab(app.tab)} page is being built.</div>
       <p style="margin-top: 16px; color: var(--muted)">This feature will be fully implemented in a subsequent phase.</p>
     </div>
  `;
}
