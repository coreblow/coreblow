import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SettingsModal, type SettingsModalProps } from "../components/SettingsModal";
import { storageService, DEFAULT_PREFERENCES } from "../services/storage";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const setInputValue = (input: HTMLInputElement, value: string) => {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  nativeSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
};

const setSelectValue = (select: HTMLSelectElement, value: string) => {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLSelectElement.prototype,
    "value",
  )?.set;
  nativeSetter?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
};

describe("SettingsModal Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  const createProps = (overrides?: Partial<SettingsModalProps>): SettingsModalProps => ({
    open: true,
    onClose: vi.fn(),
    preferences: { ...DEFAULT_PREFERENCES },
    onUpdatePreferences: vi.fn(),
    ...overrides,
  });

  beforeEach(() => {
    localStorage.clear();
    storageService.resetCache();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it("returns null when open is false", () => {
    act(() => {
      root.render(<SettingsModal {...createProps({ open: false })} />);
    });
    expect(container.innerHTML).toBe("");
  });

  it("renders all 10 root categories in the left sidebar when open is true", () => {
    act(() => {
      root.render(<SettingsModal {...createProps()} />);
    });

    const text = container.textContent || "";
    expect(text).toContain("General");
    expect(text).toContain("Models");
    expect(text).toContain("Memory & Context");
    expect(text).toContain("Workspace & Browser");
    expect(text).toContain("Safety & Permissions");
    expect(text).toContain("Channels");
    expect(text).toContain("Skills & Tool Keys");
    expect(text).toContain("Gateways");
    expect(text).toContain("Automations");
    expect(text).toContain("About");
  });

  it("toggles Models accordion and switches sub-views updating breadcrumbs", () => {
    act(() => {
      root.render(<SettingsModal {...createProps({ initialSection: "models:main" })} />);
    });

    expect(container.textContent).toContain("Settings");
    expect(container.textContent).toContain("Models");
    expect(container.textContent).toContain("Main & Reasoning");

    // Click "Fallback & Pools"
    const fallbackButton = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Fallback & Pools"),
    );
    expect(fallbackButton).toBeDefined();

    act(() => {
      fallbackButton?.click();
    });

    expect(container.textContent).toContain("Fallback & Pools");
    expect(container.textContent).toContain("DAYBREAK PROVIDER FALLBACK CHAIN");

    // Click "Auxiliary & Subagents"
    const subagentsButton = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Auxiliary & Subagents"),
    );
    expect(subagentsButton).toBeDefined();

    act(() => {
      subagentsButton?.click();
    });

    expect(container.textContent).toContain("Auxiliary & Subagents");
    expect(container.textContent).toContain("SUBAGENT DELEGATION LIMITS");
  });

  it("toggles Gateways accordion and switches sub-views updating breadcrumbs", () => {
    act(() => {
      root.render(<SettingsModal {...createProps({ initialSection: "remotes:primary" })} />);
    });

    expect(container.textContent).toContain("Settings");
    expect(container.textContent).toContain("Gateways");
    expect(container.textContent).toContain("Primary gateway");
    expect(container.textContent).toContain("PRIMARY GATEWAY CONNECTION");

    // Click "Saved nodes"
    const savedNodesButton = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Saved nodes"),
    );
    expect(savedNodesButton).toBeDefined();

    act(() => {
      savedNodesButton?.click();
    });

    expect(container.textContent).toContain("Saved nodes");
    expect(container.textContent).toContain("ALWAYS-ON REMOTE NODES");
    expect(container.textContent).toContain("ADD REMOTE NODE");
  });

  it("updates preferences when selecting each Connection Mode card and reveals contextual SSH inputs", () => {
    const onUpdatePreferences = vi.fn();
    act(() => {
      root.render(
        <SettingsModal
          {...createProps({
            initialSection: "remotes:primary",
            onUpdatePreferences,
          })}
        />,
      );
    });

    // 1. Click "Remote gateway"
    const remoteCard = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Remote gateway"),
    );
    expect(remoteCard).toBeDefined();
    act(() => {
      remoteCard?.click();
    });
    expect(onUpdatePreferences).toHaveBeenCalledWith({ connectionMode: "remote" });

    // 2. Click "Connect via SSH"
    const sshCard = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Connect via SSH"),
    );
    expect(sshCard).toBeDefined();
    act(() => {
      sshCard?.click();
    });
    expect(onUpdatePreferences).toHaveBeenCalledWith({ connectionMode: "ssh" });

    // Verify contextual SSH inputs are visible
    expect(container.textContent).toContain("SSH Tunnel Parameters");
    expect(container.textContent).toContain("SSH Host");
    expect(container.textContent).toContain("SSH Username");
    expect(container.textContent).toContain("Tunnel Command Preview");

    // 3. Click "Local gateway"
    const localCard = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Local gateway"),
    );
    expect(localCard).toBeDefined();
    act(() => {
      localCard?.click();
    });
    expect(onUpdatePreferences).toHaveBeenCalledWith({ connectionMode: "local" });
  });

  it("OS keychain encryption toggle defaults to enabled and updates preferences", () => {
    const onUpdatePreferences = vi.fn();
    act(() => {
      root.render(
        <SettingsModal
          {...createProps({
            initialSection: "remotes:primary",
            preferences: { ...DEFAULT_PREFERENCES, encryptSecretsWithKeychain: true },
            onUpdatePreferences,
          })}
        />,
      );
    });

    expect(container.textContent).toContain("Encrypt saved secrets with the OS keychain");

    // Find the toggle button in the Security & Diagnostics section
    const toggleButton = container.querySelector(
      'button[role="switch"]',
    ) as HTMLButtonElement | null;
    expect(toggleButton).not.toBeNull();

    act(() => {
      toggleButton?.click();
    });

    expect(onUpdatePreferences).toHaveBeenCalledWith({
      encryptSecretsWithKeychain: false,
    });
  });

  it("invokes window.coreblowDesktop.diagnostics.openLogs when clicking Open logs button", async () => {
    const openLogsMock = vi.fn().mockResolvedValue({ ok: true, path: "/mock/logs/desktop.log" });
    (window as any).coreblowDesktop = {
      diagnostics: { openLogs: openLogsMock },
    };

    act(() => {
      root.render(
        <SettingsModal
          {...createProps({
            initialSection: "remotes:primary",
          })}
        />,
      );
    });

    const openLogsBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Open logs"),
    );
    expect(openLogsBtn).toBeDefined();

    await act(async () => {
      openLogsBtn?.click();
    });

    expect(openLogsMock).toHaveBeenCalled();
    delete (window as any).coreblowDesktop;
  });

  it("filters settings through instant search index and jumps to target section", () => {
    act(() => {
      root.render(<SettingsModal {...createProps()} />);
    });

    const searchInput = container.querySelector<HTMLInputElement>(
      'input[placeholder*="Search settings"]',
    );
    expect(searchInput).not.toBeNull();

    act(() => {
      if (searchInput) {
        setInputValue(searchInput, "Tavily");
      }
    });

    // Should display search results matching keyword "tavily"
    expect(container.textContent).toContain("External Tool API Keys");

    // Clicking the search result switches section to "skills" (Skills & Tool Keys)
    const resultItem = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("External Tool API Keys"),
    );
    expect(resultItem).toBeDefined();

    act(() => {
      resultItem?.click();
    });

    expect(container.textContent).toContain("EXTERNAL TOOL API KEYS");
  });

  it("invokes onUpdatePreferences when modifying Tier 1 preference controls", () => {
    const onUpdatePreferences = vi.fn();
    act(() => {
      root.render(
        <SettingsModal
          {...createProps({
            initialSection: "memory",
            onUpdatePreferences,
          })}
        />,
      );
    });

    // Change memory backend
    const memoryBackendSelect = container.querySelector<HTMLSelectElement>("select");
    expect(memoryBackendSelect).not.toBeNull();

    act(() => {
      if (memoryBackendSelect) {
        setSelectValue(memoryBackendSelect, "qmd");
      }
    });

    expect(onUpdatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({ memoryBackend: "qmd" }),
    );
  });

  it("handles Escape key to clear search or close modal", () => {
    const onClose = vi.fn();
    act(() => {
      root.render(<SettingsModal {...createProps({ onClose })} />);
    });

    const searchInput = container.querySelector<HTMLInputElement>(
      'input[placeholder*="Search settings"]',
    );
    expect(searchInput).not.toBeNull();

    // Type search query
    act(() => {
      if (searchInput) {
        setInputValue(searchInput, "Safety");
      }
    });

    // Press Escape -> clears search query, does not close modal yet
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClose).not.toHaveBeenCalled();

    // Press Escape again -> closes modal
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClose).toHaveBeenCalled();
  });

  describe("StorageService Export and Import", () => {
    it("exports preferences as JSON and strips all sensitive keys", () => {
      storageService.savePreferences({
        userName: "Operator",
        anthropicApiKey: "sk-ant-secret-key-12345", // pragma: allowlist secret
        tavilyApiKey: "tvly-secret-key-67890", // pragma: allowlist secret
        memoryBackend: "builtin",
      });

      const exportedJson = storageService.exportPreferencesJson();
      expect(exportedJson).toContain('"userName": "Operator"');
      expect(exportedJson).toContain('"memoryBackend": "builtin"');
      expect(exportedJson).not.toContain("sk-ant-secret-key-12345");
      expect(exportedJson).not.toContain("tvly-secret-key-67890");
      expect(exportedJson).not.toContain("anthropicApiKey");
      expect(exportedJson).not.toContain("tavilyApiKey");
    });

    it("imports preferences JSON, strips sensitive keys, and updates preferences", () => {
      const payload = JSON.stringify({
        userName: "New Operator",
        browserMode: "headless",
        tavilyApiKey: "should-be-stripped", // pragma: allowlist secret
      });

      const result = storageService.importPreferencesJson(payload);
      expect(result.ok).toBe(true);
      expect(result.preferences?.userName).toBe("New Operator");
      expect(result.preferences?.browserMode).toBe("headless");

      const saved = storageService.getPreferences();
      expect(saved.userName).toBe("New Operator");
      expect(saved.browserMode).toBe("headless");
      expect((saved as any).tavilyApiKey).toBeUndefined();
    });

    it("returns error for invalid JSON on import", () => {
      const result = storageService.importPreferencesJson("not-a-json");
      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
