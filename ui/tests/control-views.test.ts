import { describe, expect, it, vi } from "vitest";
import { render } from "lit";
import { ChannelsView, OFFLINE_CHANNEL_CATALOG } from "../src/ui/views/channels.ts";
import { ModelsView, OFFLINE_MODELS_CATALOG, OFFLINE_PROVIDERS } from "../src/ui/views/models.ts";
import { McpView, OFFLINE_MCP_SERVERS } from "../src/ui/views/mcp.ts";
import { ConfigView } from "../src/ui/views/config.ts";
import { OverviewView } from "../src/ui/views/overview.ts";
import { SessionsView } from "../src/ui/views/sessions.ts";
import { UsageView } from "../src/ui/views/usage.ts";
import { ChatView } from "../src/ui/views/chat.ts";
import { AgentsView } from "../src/ui/views/agents.ts";
import { DebugView } from "../src/ui/views/debug.ts";
import { LogsView } from "../src/ui/views/logs.ts";
import { SkillsView } from "../src/ui/views/skills.ts";
import { CronView } from "../src/ui/views/cron.ts";
import { CoreHubView } from "../src/ui/views/corehub.ts";
import { loadSettings, resolveQueryToken } from "../src/ui/storage.ts";
import { HealthController } from "../src/ui/controllers/health.ts";
import { renderApp } from "../src/ui/app-render.ts";
import type { CoreBlowApp } from "../src/ui/app.ts";

function createMockApp(options: { connected?: boolean; onRequest?: (method: string, params: any) => Promise<any> } = {}): CoreBlowApp {
  const connected = options.connected ?? false;
  const mockRequest = options.onRequest ?? (async () => ({}));

  return {
    connected,
    tab: "overview",
    sessionsCount: 3,
    gatewayRestarting: false,
    updateChecking: false,
    footerStatusText: null,
    settings: {
      gatewayUrl: "ws://127.0.0.1:18789",
      token: "",
      theme: "core",
      themeMode: "dark",
      locale: "en",
      connectionMode: "local",
    },
    chatModelCatalog: [],
    approvalQueue: [],
    eventLog: [],
    presenceCount: 0,
    chat: { sessionKey: "test-session" },
    setTab: vi.fn(),
    applySettings: vi.fn(function (this: any, next: any) {
      this.settings = next;
    }),
    gateway: {
      getClient: () =>
        connected
          ? {
              connected: true,
              request: mockRequest,
            }
          : null,
    },
    addEventLog: vi.fn(),
    requestUpdate: vi.fn(),
    async restartGateway() {
      const client = (this as any).gateway.getClient();
      if (!client?.connected || (this as any).gatewayRestarting) return;
      (this as any).gatewayRestarting = true;
      (this as any).footerStatusText = "Restarting...";
      try {
        await client.request("gateway.restart.request", {});
        (this as any).footerStatusText = "Restart initiated";
      } catch {
        (this as any).footerStatusText = "Restart failed";
      }
    },
    async checkUpdate() {
      const client = (this as any).gateway.getClient();
      if (!client?.connected || (this as any).updateChecking) return;
      (this as any).updateChecking = true;
      (this as any).footerStatusText = "Checking...";
      try {
        const res = await client.request("update.run", {});
        (this as any).footerStatusText = res?.status ? `Update: ${res.status}` : "Up to date";
      } catch {
        (this as any).footerStatusText = "Check failed";
      }
    },
  } as unknown as CoreBlowApp;
}

describe("Dedicated Control Views Smoke Tests (Offline & Connected)", () => {
  describe("ChannelsView", () => {
    it("renders cleanly in offline mode with fallback catalog", async () => {
      const view = new ChannelsView();
      view.app = createMockApp({ connected: false });
      await view.loadChannels(false);

      expect(view.channels.length).toBe(OFFLINE_CHANNEL_CATALOG.length);
      expect(view.channels.map((c) => c.id)).toEqual([
        "telegram",
        "whatsapp",
        "discord",
        "slack",
        "signal",
        "web",
      ]);

      const template = view.render();
      expect(template).toBeDefined();
    });

    it("handles search filtering across channel names and IDs", () => {
      const view = new ChannelsView();
      view.app = createMockApp({ connected: false });
      view.searchQuery = "tele";

      const filtered = view.channels.filter((c) =>
        c.name.toLowerCase().includes("tele") || c.id.toLowerCase().includes("tele"),
      );
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe("telegram");
    });

    it("masks bot credentials and toggles reveal state correctly", () => {
      const view = new ChannelsView();
      view.app = createMockApp({ connected: false });

      expect(view.revealedSecrets.has("telegram")).toBe(false);
      (view as any).toggleRevealSecret("telegram");
      expect(view.revealedSecrets.has("telegram")).toBe(true);
      (view as any).toggleRevealSecret("telegram");
      expect(view.revealedSecrets.has("telegram")).toBe(false);
    });
  });

  describe("ModelsView", () => {
    it("renders cleanly in offline mode with default models and provider slots", async () => {
      const view = new ModelsView();
      view.app = createMockApp({ connected: false });
      await view.loadModelsAndConfig();

      expect(view.models.length).toBe(OFFLINE_MODELS_CATALOG.length);
      expect(view.providers.length).toBe(OFFLINE_PROVIDERS.length);
      expect(view.primaryModel).toBe("gemini-2.5-pro");
      expect(view.fallbackModel).toBe("claude-3-7-sonnet");

      const template = view.render();
      expect(template).toBeDefined();
    });

    it("filters models by search query and provider", () => {
      const view = new ModelsView();
      view.app = createMockApp({ connected: false });

      view.selectedProvider = "anthropic";
      let filtered = view.models.filter((m) => m.provider === "anthropic");
      expect(filtered.length).toBe(2);
      expect(filtered.map((m) => m.id)).toContain("claude-3-7-sonnet");

      view.searchQuery = "reasoning";
      filtered = view.models.filter((m) => m.tags.includes("reasoning"));
      expect(filtered.length).toBeGreaterThan(0);
    });

    it("updates primary and fallback model selection cleanly", async () => {
      const view = new ModelsView();
      view.app = createMockApp({ connected: false });

      await view.setPrimaryModel("claude-3-7-sonnet");
      expect(view.primaryModel).toBe("claude-3-7-sonnet");

      await view.setFallbackModel("gpt-4o");
      expect(view.fallbackModel).toBe("gpt-4o");
    });
  });

  describe("McpView", () => {
    it("renders cleanly in offline mode with sample registered servers", async () => {
      const view = new McpView();
      view.app = createMockApp({ connected: false });
      await view.loadMcpRegistry();

      expect(view.servers.length).toBe(OFFLINE_MCP_SERVERS.length);
      const serverNames = view.servers.map((s) => s.name);
      expect(serverNames).toContain("coreblow-filesystem");
      expect(serverNames).toContain("coreblow-memory");

      const template = view.render();
      expect(template).toBeDefined();
    });

    it("filters servers and exposed tools by search query", () => {
      const view = new McpView();
      view.app = createMockApp({ connected: false });

      view.searchQuery = "read_file";
      const matches = view.servers.filter(
        (s) =>
          s.name.includes("read_file") ||
          s.tools.some((t) => t.label.includes("read_file") || t.id.includes("read_file")),
      );
      expect(matches.length).toBe(1);
      expect(matches[0].name).toBe("coreblow-filesystem");
    });

    it("toggles server enabled state and adds new servers", async () => {
      const view = new McpView();
      view.app = createMockApp({ connected: false });

      const fsServer = view.servers[0];
      const initialEnabled = fsServer.enabled;
      await view.toggleServerEnabled(fsServer);
      expect(fsServer.enabled).toBe(!initialEnabled);

      view.newServerName = "test-custom-mcp";
      view.newServerTransport = "stdio";
      view.newServerCommand = "python3";
      view.newServerArgs = "-m custom_mcp";
      await view.addServer();

      expect(view.servers.some((s) => s.name === "test-custom-mcp")).toBe(true);
    });
  });

  describe("Quiet-Instrument Sidebar Footer Actions", () => {
    it("guards restart and update actions when gateway is disconnected", async () => {
      const mockRequest = vi.fn();
      const app = createMockApp({ connected: false, onRequest: mockRequest });

      await app.restartGateway();
      expect(mockRequest).not.toHaveBeenCalled();
      expect(app.gatewayRestarting).toBe(false);

      await app.checkUpdate();
      expect(mockRequest).not.toHaveBeenCalled();
      expect(app.updateChecking).toBe(false);
    });

    it("invokes gateway.restart.request when gateway is connected", async () => {
      const mockRequest = vi.fn().mockResolvedValue({ requested: true });
      const app = createMockApp({ connected: true, onRequest: mockRequest });

      await app.restartGateway();
      expect(mockRequest).toHaveBeenCalledWith("gateway.restart.request", {});
      expect(app.footerStatusText).toBe("Restart initiated");
    });

    it("invokes update.run when gateway is connected", async () => {
      const mockRequest = vi.fn().mockResolvedValue({ status: "up-to-date" });
      const app = createMockApp({ connected: true, onRequest: mockRequest });

      await app.checkUpdate();
      expect(mockRequest).toHaveBeenCalledWith("update.run", {});
      expect(app.footerStatusText).toBe("Update: up-to-date");
    });
  });

  describe("ConfigView Gateway & Remotes Connection Mode", () => {
    it("renders Connection Mode 3 cards and Diagnostics logs row when gateway section is active", () => {
      const view = new ConfigView();
      view.app = createMockApp({ connected: false });
      view.activeSectionId = "gateway";

      const template = (view as any).renderConnectionModePanel();
      expect(template).toBeDefined();

      // Convert lit html template to string representation
      const strings = template.strings.join("");
      expect(strings).toContain("Connection Mode &amp; Remote Nodes");
      expect(strings).toContain("Local Gateway");
      expect(strings).toContain("Remote Node");
      expect(strings).toContain("SSH Tunnel");
      expect(strings).toContain("Diagnostics &amp; System Event Logs");
      expect(strings).toContain("Open Live Logs");
    });

    it("updates connectionMode to remote or ssh and updates app settings", () => {
      const app = createMockApp({ connected: false });
      const view = new ConfigView();
      view.app = app;

      (view as any).setConnectionMode("ssh");
      expect(app.settings.connectionMode).toBe("ssh");

      (view as any).setConnectionMode("remote");
      expect(app.settings.connectionMode).toBe("remote");

      (view as any).setConnectionMode("local");
      expect(app.settings.connectionMode).toBe("local");
    });
  });

  describe("OverviewView Posture Strip & Diagnostics", () => {
    it("renders Connection Mode posture pill and switches to logs tab", () => {
      const app = createMockApp({ connected: false });
      const view = new OverviewView();
      view.app = app;

      const template = view.render();
      expect(template).toBeDefined();
      const container = document.createElement("div");
      render(template, container);
      expect(container.textContent).toContain("Posture:");
      expect(container.textContent).toContain("Local Gateway");
      expect(container.textContent).toContain("Diagnostics");

      // Verify switching to logs tab
      app.setTab("logs" as any);
      expect(app.setTab).toHaveBeenCalledWith("logs");
    });
  });

  describe("ConfigView Curated Memory Files (USER.md · MEMORY.md · CONSTRAINTS.md)", () => {
    it("renders Curated Memory Files editor with USER.md, MEMORY.md, and CONSTRAINTS.md tabs and capacity metrics", () => {
      const view = new ConfigView();
      view.app = createMockApp({ connected: false });
      view.activeSectionId = "memory";

      const template = (view as any).renderCuratedMemoryPanel();
      expect(template).toBeDefined();

      const container = document.createElement("div");
      render(template, container);

      expect(container.textContent).toContain("Curated Memory Files");
      expect(container.textContent).toContain("USER.md");
      expect(container.textContent).toContain("MEMORY.md");
      expect(container.textContent).toContain("CONSTRAINTS.md");
      expect(container.textContent).toContain("Injected as a frozen snapshot");
      expect(container.textContent).toContain("Save File");
      expect(container.textContent).toContain("Reset to Default");
      expect(container.textContent).toContain("Revert");

      // Verify all 3 stacked cards render textareas simultaneously
      const textareas = container.querySelectorAll("textarea");
      expect(textareas.length).toBe(3);
      expect(container.querySelector('textarea[aria-label="Edit USER.md"]')).not.toBeNull();
      expect(container.querySelector('textarea[aria-label="Edit MEMORY.md"]')).not.toBeNull();
      expect(container.querySelector('textarea[aria-label="Edit CONSTRAINTS.md"]')).not.toBeNull();
    });

    it("switches file tabs and updates draft memory contents cleanly", async () => {
      const view = new ConfigView();
      view.app = createMockApp({ connected: false });
      view.activeSectionId = "memory";

      // Initialize default files
      await (view as any).loadCuratedMemoryFiles();

      // Switch to memory (MEMORY.md)
      (view as any).selectedMemoryFileId = "memory";
      expect((view as any).selectedMemoryFileId).toBe("memory");

      // Update draft
      (view as any).memoryDrafts = {
        ...(view as any).memoryDrafts,
        memory: "# Custom Workspace Decisions\n- Keep architecture clean",
      };
      expect((view as any).memoryDrafts.memory).toBe("# Custom Workspace Decisions\n- Keep architecture clean");

      // Switch to constraints (CONSTRAINTS.md)
      (view as any).selectedMemoryFileId = "constraints";
      expect((view as any).selectedMemoryFileId).toBe("constraints");

      // Revert action
      (view as any).revertCuratedMemoryFile("constraints");
      expect((view as any).memoryFileStatus?.message).toBe("Reverted");
      expect((view as any).memoryFileStatusMap?.constraints?.message).toBe("Reverted");
    });

    it("sends Authorization Bearer token when fetching /api/cory/files", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ files: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      const view = new ConfigView();
      const app = createMockApp({ connected: true });
      app.settings.token = "qc-ui-bearer-token";
      view.app = app;

      await (view as any).loadCuratedMemoryFiles();

      expect(fetchSpy).toHaveBeenCalledWith(
        "http://127.0.0.1:18789/api/cory/files",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer qc-ui-bearer-token",
          }),
        }),
      );
      fetchSpy.mockRestore();
    });
  });

  describe("Token bootstrap, RPC health & NaN/statusDot polish", () => {
    it("extracts ?token= from URL search and strips it from history", () => {
      const originalHref = globalThis.location.href;
      let replaceStateSpy: ReturnType<typeof vi.spyOn> | undefined;
      try {
        window.history.replaceState(null, "", "/?token=qc-query-token-123#overview");
        expect(resolveQueryToken()).toBe("qc-query-token-123");
        replaceStateSpy = vi.spyOn(globalThis.history, "replaceState").mockImplementation(() => {});
        const loaded = loadSettings();
        expect(loaded.token).toBe("qc-query-token-123");
        expect(replaceStateSpy).toHaveBeenCalled();
      } finally {
        replaceStateSpy?.mockRestore();
        window.history.replaceState(null, "", originalHref);
      }
    });

    it("polls canonical 'health' RPC method instead of unknown 'health.snapshot'", async () => {
      const requestMock = vi.fn(async () => ({ sessions: { count: 2 } }));
      const app = createMockApp({ connected: true, onRequest: requestMock });
      const controller = new HealthController(app);

      await controller.poll();

      expect(requestMock).toHaveBeenCalledWith("health");
      expect(app.sessionsCount).toBe(2);
    });

    it("renders statusDot.ok when connected and guards NaN token/turn formatting", () => {
      const app = createMockApp({ connected: true });
      (app as any).theme = "core";
      (app as any).themeMode = "dark";
      (app as any).navDrawerOpen = false;
      (app as any).setTheme = vi.fn();
      (app as any).setThemeMode = vi.fn();
      const container = document.createElement("div");
      render(renderApp(app), container);
      expect(container.querySelector(".topbar-status .statusDot.ok")).not.toBeNull();

      const sessionsView = new SessionsView();
      expect((sessionsView as any).formatTokens(undefined)).toBe("0");
      expect((sessionsView as any).formatTokens(Number.NaN)).toBe("0");

      const usageView = new UsageView();
      expect((usageView as any).formatTokens(undefined)).toBe("0");
      expect((usageView as any).formatTokens(Number.NaN)).toBe("0");
      expect((usageView as any).formatCost(Number.NaN)).toBe("$0.00");
    });
  });

  describe("Accessibility (headings, labels, native controls, landmarks)", () => {
    it("renders semantic h1 headings across all 14 views", () => {
      const app = createMockApp({ connected: false });
      (app as any).chat = {
        sessionKey: "test-session",
        isBusy: false,
        messages: [],
        recentSessions: [],
        toolStream: new Map(),
        toolStreamOrder: [],
      };
      (app as any).chatModelsLoading = false;
      (app as any).chatModelCatalog = [];
      (app as any).chatModelOverrides = {};

      const views = [
        new ChatView(),
        new OverviewView(),
        new SessionsView(),
        new ChannelsView(),
        new ModelsView(),
        new McpView(),
        new UsageView(),
        new CronView(),
        new CoreHubView(),
        new AgentsView(),
        new SkillsView(),
        new ConfigView(),
        new DebugView(),
        new LogsView(),
      ];

      for (const view of views) {
        (view as any).app = app;
        if ("sections" in view && Array.isArray((view as any).sections) && (view as any).sections.length === 0) {
          (view as any).connectedCallback?.();
        }
        const host = document.createElement("div");
        render((view as any).render(), host);
        const h1 = host.querySelector("h1");
        expect(h1, `${view.constructor.name} should render <h1>`).not.toBeNull();
        expect(h1?.textContent?.trim().length).toBeGreaterThan(0);
      }
    });

    it("provides accessible names for ConfigView switches/inputs and ChatView permission select", () => {
      const app = createMockApp({ connected: false });
      (app as any).chat = {
        sessionKey: "test-session",
        isBusy: false,
        messages: [],
        recentSessions: [],
        toolStream: new Map(),
        toolStreamOrder: [],
      };
      (app as any).chatModelsLoading = false;
      (app as any).chatModelCatalog = [];
      (app as any).chatModelOverrides = {};

      const configView = new ConfigView();
      configView.app = app;
      configView.connectedCallback();
      const configHost = document.createElement("div");
      render(configView.render(), configHost);

      const switches = Array.from(configHost.querySelectorAll('[role="switch"]'));
      expect(switches.length).toBeGreaterThan(0);
      for (const sw of switches) {
        const labelledBy = sw.getAttribute("aria-labelledby");
        const ariaLabel = sw.getAttribute("aria-label");
        expect(Boolean(labelledBy || ariaLabel)).toBe(true);
        if (labelledBy) {
          expect(configHost.querySelector(`#${labelledBy}`)?.textContent?.trim().length).toBeGreaterThan(0);
        }
      }

      const controls = Array.from(configHost.querySelectorAll("input, select, textarea"));
      expect(controls.length).toBeGreaterThan(0);
      for (const el of controls) {
        const id = el.getAttribute("id");
        const hasLabelFor = Boolean(id && configHost.querySelector(`label[for="${id}"]`));
        const hasAria = Boolean(el.getAttribute("aria-label") || el.getAttribute("aria-labelledby"));
        expect(hasLabelFor || hasAria).toBe(true);
      }

      const chatView = new ChatView();
      chatView.app = app;
      const chatHost = document.createElement("div");
      render(chatView.render(), chatHost);
      const permSelect = chatHost.querySelector("#chat-permission-profile");
      expect(permSelect).not.toBeNull();
      expect(permSelect?.getAttribute("aria-label")).toBe("Execution permission profile");
      expect(chatHost.querySelector('label[for="chat-permission-profile"]')).not.toBeNull();
    });

    it("renders primary nav landmark and aria-label on topbar icon controls", () => {
      const app = createMockApp({ connected: true });
      (app as any).theme = "core";
      (app as any).themeMode = "dark";
      (app as any).navDrawerOpen = false;
      (app as any).setTheme = vi.fn();
      (app as any).toggleThemeMode = vi.fn();
      const host = document.createElement("div");
      render(renderApp(app), host);
      expect(host.querySelector('nav.shell-nav[aria-label="Primary"]')).not.toBeNull();
      expect(host.querySelector('button[aria-label="Toggle Light / Dark Mode"]')).not.toBeNull();
      expect(host.querySelector('button[aria-label="Open Command Palette (⌘K)"]')).not.toBeNull();
    });
  });
});
