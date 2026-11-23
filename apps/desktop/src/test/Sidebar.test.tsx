import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Sidebar } from "../components/Sidebar";
import type { ChatThread } from "../types/gateway";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("Sidebar Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockThreads: ChatThread[] = [
    {
      id: "thread-1",
      title: "Backend Routing Optimization",
      messages: [],
      createdAt: Date.now() - 10000,
      updatedAt: Date.now() - 5000,
      executionProfile: "Guarded",
      model: "High Reasoning",
      pinned: true,
    },
    {
      id: "thread-2",
      title: "OLED Canvas UI Polish",
      messages: [],
      createdAt: Date.now() - 20000,
      updatedAt: Date.now() - 15000,
      executionProfile: "Guarded",
      model: "High Reasoning",
      pinned: false,
    },
  ];

  const defaultProps = {
    threads: mockThreads,
    activeThreadId: "thread-1",
    onSelectThread: vi.fn(),
    onNewThread: vi.fn(),
    onDeleteThread: vi.fn(),
    onTogglePinThread: vi.fn(),
    collapsed: false,
    onToggleCollapse: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenTab: vi.fn(),
  };

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders CoreBlow brand wordmark and SESSIONS | AGENT switcher", () => {
    act(() => {
      root.render(<Sidebar {...defaultProps} />);
    });
    expect(container.textContent).toContain("COREBLOW");
    expect(container.textContent).toContain("SESSIONS");
    expect(container.textContent).toContain("AGENT");
  });

  it("switches to AGENT tab and opens warroom in right panel", () => {
    const onOpenTab = vi.fn();
    act(() => {
      root.render(<Sidebar {...defaultProps} onOpenTab={onOpenTab} />);
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const agentBtn = buttons.find((b) => b.textContent?.trim() === "AGENT");
    expect(agentBtn).toBeDefined();

    act(() => {
      agentBtn?.click();
    });

    expect(onOpenTab).toHaveBeenCalledWith("warroom");
  });

  it("renders exactly 2 quick navigation items: Capabilities and Scheduled jobs", () => {
    const onOpenTab = vi.fn();
    const onOpenSettings = vi.fn();
    act(() => {
      root.render(
        <Sidebar
          {...defaultProps}
          onOpenTab={onOpenTab}
          onOpenSettings={onOpenSettings}
        />,
      );
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const capBtn = buttons.find((b) => b.textContent?.includes("Capabilities"));
    expect(capBtn).toBeDefined();
    act(() => {
      capBtn?.click();
    });
    expect(onOpenTab).toHaveBeenCalledWith("corehub");

    const schedBtn = buttons.find((b) => b.textContent?.includes("Scheduled jobs"));
    expect(schedBtn).toBeDefined();
    act(() => {
      schedBtn?.click();
    });
    expect(onOpenSettings).toHaveBeenCalledWith("automations");
  });

  it("filters conversation list in real-time when searching", () => {
    act(() => {
      root.render(<Sidebar {...defaultProps} />);
    });

    const input = container.querySelector('input[placeholder="Search chats..."]') as HTMLInputElement;
    expect(input).not.toBeNull();

    expect(container.textContent).toContain("Backend Routing Optimization");
    expect(container.textContent).toContain("OLED Canvas UI Polish");

    act(() => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      nativeInputValueSetter?.call(input, "OLED");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(container.textContent).not.toContain("Backend Routing Optimization");
    expect(container.textContent).toContain("OLED Canvas UI Polish");
  });

  it("triggers + New Chat and Settings with keyboard hints", () => {
    const onNewThread = vi.fn();
    const onOpenSettings = vi.fn();
    act(() => {
      root.render(
        <Sidebar
          {...defaultProps}
          onNewThread={onNewThread}
          onOpenSettings={onOpenSettings}
        />,
      );
    });

    expect(container.textContent).toContain("⌘N");
    expect(container.textContent).toContain("⌘,");

    const buttons = Array.from(container.querySelectorAll("button"));
    const newChatBtn = buttons.find((b) => b.textContent?.includes("New Chat"));
    act(() => {
      newChatBtn?.click();
    });
    expect(onNewThread).toHaveBeenCalledTimes(1);

    const settingsBtn = buttons.find((b) => b.textContent?.includes("Settings"));
    act(() => {
      settingsBtn?.click();
    });
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
