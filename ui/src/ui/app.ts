import { LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { renderApp } from "./app-render.ts";
import { loadSettings, UiSettings } from "./storage.ts";
import { ThemeName, ThemeMode, VALID_THEME_NAMES } from "./theme.ts";
import { Tab, iconForTab, titleForTab, TAB_GROUPS } from "./navigation.ts";
import { GatewayController } from "./app-gateway.ts";
import { HealthController } from "./controllers/health.ts";
import { ChatController } from "./app-chat.ts";
import { SessionsController } from "./controllers/sessions.ts";
import { ConfigController } from "./controllers/config.ts";
import { AgentsController } from "./controllers/agents.ts";

export type EventLogEntry = { ts: number; raw: string; level?: string };

@customElement("coreblow-app")
export class CoreBlowApp extends LitElement {
  @state() settings: UiSettings = loadSettings();
  @state() tab: Tab = "overview";
  @state() connected = false;

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

  setTheme(next: ThemeName) {
    this.theme = next;
    this.applySettings({ ...this.settings, theme: next });

    // Apply data-theme attribute for CSS variable switching
    try {
       const resolved = next === "knot" ? "openknot" : next === "coredash" ? "coredash" : "dark";
       document.documentElement.setAttribute("data-theme", resolved);
    } catch {}
  }

  applySettings(next: UiSettings) {
    this.settings = next;
    try {
      localStorage.setItem("coreblow.control.settings.v1", JSON.stringify(next));
    } catch {}
  }

  addEventLog(msg: string) {
    this.eventLog = [{ ts: Date.now(), raw: msg, level: "info" }, ...this.eventLog].slice(0, 100);
  }

  render() {
    return renderApp(this);
  }
}
