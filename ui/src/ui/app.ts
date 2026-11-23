import { LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { i18n, I18nController, isSupportedLocale } from "../i18n/index.ts";
import { renderApp } from "./app-render.ts";
import { loadSettings, saveSettings, type UiSettings } from "./storage.ts";
import { ThemeName, ThemeMode } from "./theme.ts";
import { Tab, iconForTab } from "./navigation.ts";
import { GatewayController } from "./app-gateway.ts";
import { HealthController } from "./controllers/health.ts";
import { ChatController } from "./app-chat.ts";
import { SessionsController } from "./controllers/sessions.ts";
import { ConfigController } from "./controllers/config.ts";
import { AgentsController } from "./controllers/agents.ts";

export type EventLogEntry = { ts: number; raw: string; level?: string };

@customElement("coreblow-app")
export class CoreBlowApp extends LitElement {
  private i18nController = new I18nController(this);
  @state() settings: UiSettings = loadSettings();
  @state() tab: Tab = "overview";
  @state() connected = false;

  constructor() {
    super();
    if (isSupportedLocale(this.settings.locale)) {
      void i18n.setLocale(this.settings.locale);
    }
  }

  @state() theme: ThemeName = this.settings.theme;
  @state() themeMode: ThemeMode = this.settings.themeMode;

  @state() navDrawerOpen = false;
  @state() eventLog: EventLogEntry[] = [];

  // Connect gateway
  gateway = new GatewayController(this);
  health = new HealthController(this);
  chat = new ChatController(this);
  sessionsController = new SessionsController(this);
  configController = new ConfigController(this);
  agentsController = new AgentsController(this);

  // Dashboard state
  @state() sessionsCount = 0;
  @state() presenceCount = 0;

  // Live Gateway sidebar footer state
  @state() gatewayRestarting = false;
  @state() updateChecking = false;
  @state() footerStatusText: string | null = null;

  // Model catalog
  @state() chatModelCatalog: import('./controllers/models.ts').ModelCatalogEntry[] = [];
  @state() chatModelsLoading = false;
  @state() chatModelOverrides: Record<string, string | null> = {};

  // Tool approval queue
  @state() approvalQueue: import('./views/tool-approval-modal.ts').ToolApprovalEntry[] = [];

  createRenderRoot() {
    // Render in light DOM for simpler CSS sharing
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventLog("System started");

    // Listen for hash changes to match basic routing
    window.addEventListener("hashchange", this.handleHashChange);
    this.handleHashChange();

    // Connect to backend
    this.gateway.start();
    this.health.start();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("hashchange", this.handleHashChange);
    this.gateway.stop();
    this.health.stop();
  }

  private handleHashChange = () => {
    const hash = window.location.hash.replace("#", "") as Tab;
    if (hash && iconForTab(hash) !== "folder") {
      this.tab = hash;
    }
  }

  setTab(next: Tab) {
    this.tab = next;
    window.location.hash = `#${next}`;
  }

  private applyThemeAttributes(theme: ThemeName, mode: ThemeMode) {
    try {
      const effectiveMode =
        mode === "system"
          ? window.matchMedia("(prefers-color-scheme: light)").matches
            ? "light"
            : "dark"
          : mode;
      const resolved =
        theme === "obsidian"
          ? effectiveMode === "light"
            ? "obsidian-light"
            : "obsidian"
          : theme === "coredash"
            ? effectiveMode === "light"
              ? "coredash-light"
              : "coredash"
            : effectiveMode === "light"
              ? "light"
              : "dark";
      document.documentElement.setAttribute("data-theme", resolved);
      document.documentElement.setAttribute("data-theme-mode", effectiveMode);
    } catch {}
  }

  setTheme(next: ThemeName) {
    this.theme = next;
    this.applySettings({ ...this.settings, theme: next });
    this.applyThemeAttributes(next, this.themeMode);
  }

  toggleThemeMode() {
    const currentIsLight =
      document.documentElement.getAttribute("data-theme-mode") === "light";
    const nextMode: ThemeMode = currentIsLight ? "dark" : "light";
    this.themeMode = nextMode;
    this.applySettings({ ...this.settings, themeMode: nextMode });
    this.applyThemeAttributes(this.theme, nextMode);
  }

  applySettings(next: UiSettings) {
    const previousLocale = this.settings.locale;
    this.settings = next;
    saveSettings(next);
    if (next.locale !== previousLocale && isSupportedLocale(next.locale)) {
      void i18n.setLocale(next.locale);
    }
  }

  addEventLog(msg: string) {
    this.eventLog = [{ ts: Date.now(), raw: msg, level: "info" }, ...this.eventLog].slice(0, 100);
  }

  async restartGateway() {
    const client = this.gateway.getClient();
    if (!client?.connected || this.gatewayRestarting) return;

    this.gatewayRestarting = true;
    this.footerStatusText = "Restarting...";
    try {
      await client.request("gateway.restart.request", {});
      this.footerStatusText = "Restart initiated";
      this.addEventLog("Gateway restart requested");
    } catch (err) {
      console.warn("Failed to request gateway restart:", err);
      this.footerStatusText = "Restart failed";
    } finally {
      setTimeout(() => {
        this.gatewayRestarting = false;
        this.footerStatusText = null;
      }, 3000);
    }
  }

  async checkUpdate() {
    const client = this.gateway.getClient();
    if (!client?.connected || this.updateChecking) return;

    this.updateChecking = true;
    this.footerStatusText = "Checking...";
    try {
      const res = await client.request<{ status?: string }>("update.run", {});
      this.footerStatusText = res?.status ? `Update: ${res.status}` : "Up to date";
      this.addEventLog(`Gateway update check: ${res?.status ?? "done"}`);
    } catch (err) {
      console.warn("Failed to run gateway update check:", err);
      this.footerStatusText = "Check failed";
    } finally {
      setTimeout(() => {
        this.updateChecking = false;
        this.footerStatusText = null;
      }, 3000);
    }
  }

  render() {
    return renderApp(this);
  }
}
