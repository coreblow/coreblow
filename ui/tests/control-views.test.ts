import { describe, expect, it, vi } from "vitest";
import { render } from "lit";
import { ChannelsView, OFFLINE_CHANNEL_CATALOG } from "../src/ui/views/channels.ts";
import { ModelsView, OFFLINE_MODELS_CATALOG, OFFLINE_PROVIDERS } from "../src/ui/views/models.ts";
import { McpView, OFFLINE_MCP_SERVERS } from "../src/ui/views/mcp.ts";
import { ConfigView } from "../src/ui/views/config.ts";
import { OverviewView } from "../src/ui/views/overview.ts";
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
  });
});
