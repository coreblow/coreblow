import { describe, expect, it } from "vitest";
import { render } from "lit";
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

  it("renders assistant message as borderless prose without avatar box or icon tile", () => {
    const view = new ChatView();
    view.app = createMockApp();

    const template = (view as any).renderMessage({
      id: "asst-1",
      role: "assistant",
      content: "CoreBlow microkernel provides zero-copy memory safety.",
      ts: 2000,
    });
    expect(template).toBeDefined();

    const container = document.createElement("div");
    render(template, container);

    expect(container.textContent).toContain("CoreBlow microkernel provides zero-copy memory safety.");
    // Zero avatar box
    expect(container.querySelector(".chat-avatar")).toBeNull();
    // Verify borderless prose
    const msgEl = container.querySelector(".chat-message--assistant") as HTMLElement;
    expect(msgEl).not.toBeNull();
    expect(msgEl.style.background).toBe("transparent");
    expect(msgEl.style.borderStyle).toBe("none");
    // Bubble inside is also borderless
    const bubble = container.querySelector(".chat-bubble") as HTMLElement;
    expect(bubble.getAttribute("style")).toContain("background: transparent");
    expect(bubble.getAttribute("style")).toContain("border: none");
    // Copy button is present
    expect(container.querySelector(".bubble-copy-btn")).not.toBeNull();
  });

  it("renders assistant error as clean borderless inline text in soft red", () => {
    const view = new ChatView();
    view.app = createMockApp();

    const template = (view as any).renderMessage({
      id: "asst-err",
      role: "assistant",
      content: "",
      error: "Gateway connection timeout",
      ts: 2001,
    });
    expect(template).toBeDefined();

    const container = document.createElement("div");
    render(template, container);

    expect(container.textContent).toContain("Error: Gateway connection timeout");
    expect(container.querySelector(".chat-avatar")).toBeNull();

    const errorEl = container.querySelector(".message-error") as HTMLElement;
    expect(errorEl).not.toBeNull();
    expect(errorEl.style.color).toContain("danger");
  });
});
