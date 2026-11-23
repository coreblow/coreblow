import { describe, expect, it } from "vitest";
import { ChatView } from "../src/ui/views/chat.ts";
import type { CoreBlowApp } from "../src/ui/app.ts";

function createMockApp(): CoreBlowApp {
  return {
    connected: true,
    settings: {
      gatewayUrl: "ws://127.0.0.1:18789",
      token: "",
      theme: "core",
      themeMode: "dark",
      locale: "en",
    },
    chat: {
      messages: [],
      sessionKey: "test-session-123",
      chatStream: null,
      chatRunId: null,
      chatSending: false,
      toolStreamOrder: [],
      toolStream: new Map(),
      recentSessions: [],
      isBusy: false,
      send: () => {},
      abort: () => {},
      newSession: () => {},
      selectSession: () => {},
      deleteSession: () => {},
    },
    chatModelCatalog: [],
    chatModelsLoading: false,
    chatModelOverrides: {},
    approvalQueue: [],
    gateway: {
      getClient: () => null,
    },
    applySettings: () => {},
    requestUpdate: () => {},
  } as unknown as CoreBlowApp;
}

describe("ChatView workspace ergonomics", () => {
  it("initializes with workspace drawer closed and default files", () => {
    const view = new ChatView();
    view.app = createMockApp();
    expect(view.showWorkspaceDrawer).toBe(false);
    expect(view.activeWorkspaceTab).toBe("files");
    expect(view.workspaceFiles.length).toBeGreaterThan(0);
  });

  it("toggles workspace drawer open and closed", () => {
    const view = new ChatView();
    view.app = createMockApp();

    view.toggleWorkspaceDrawer();
    expect(view.showWorkspaceDrawer).toBe(true);
    expect(view.selectedArtifact).toBeDefined();
    expect(view.selectedArtifact?.name).toBe("active-workspace.md");

    view.toggleWorkspaceDrawer();
    expect(view.showWorkspaceDrawer).toBe(false);
  });

  it("selects a workspace file for preview and switches active tab to preview", () => {
    const view = new ChatView();
    view.app = createMockApp();

    view.selectFileForPreview({
      name: "src/cli/desktop-cli.ts",
      content: "export const desktop = true;",
    });

    expect(view.activeWorkspaceTab).toBe("preview");
    expect(view.selectedArtifact).toEqual({
      name: "src/cli/desktop-cli.ts",
      content: "export const desktop = true;",
      language: "typescript",
    });
  });

  it("renders context ring with token utilization against 78% compaction threshold", () => {
    const view = new ChatView();
    const mockApp = createMockApp();
    mockApp.chat.messages = [
      { id: "1", role: "user", content: "Hello from CoreBlow", ts: 1000 },
      { id: "2", role: "assistant", content: "Hello! Ready to assist.", ts: 1001 },
    ];
    view.app = mockApp;

    const template = view.renderContextRing();
    expect(template).toBeDefined();
    // Verify template structure string contains context-ring class and 78% threshold
    const str = JSON.stringify(template);
    expect(str).toContain("context-ring");
    expect(str).toContain("78%");
  });

  it("extracts structured thinking blocks from message content", () => {
    const view = new ChatView();
    view.app = createMockApp();

    const result = (view as any).extractThinking(
      "<think>Evaluating system status and sqlite WAL.</think>System is operational.",
    );

    expect(result.thinking).toBe("Evaluating system status and sqlite WAL.");
    expect(result.cleanContent).toBe("System is operational.");
  });
});
