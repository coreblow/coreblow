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

  it("switches to AGENT tab and renders dedicated AGENTS list without forcing warroom drawer", () => {
    const onOpenTab = vi.fn();
    const onChangeMode = vi.fn();
    act(() => {
      root.render(<Sidebar {...defaultProps} onOpenTab={onOpenTab} onChangeMode={onChangeMode} />);
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const agentBtn = buttons.find((b) => b.textContent?.trim() === "AGENT");
    expect(agentBtn).toBeDefined();

    act(() => {
      agentBtn?.click();
    });

    expect(onChangeMode).toHaveBeenCalledWith("agent");
    expect(onOpenTab).not.toHaveBeenCalledWith("warroom");
    expect(container.textContent).toContain("AGENTS");
    expect(container.textContent).toContain("CoreBlow");
    expect(container.textContent).not.toContain("New Chat");
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
    expect(capBtn?.style.borderStyle).toBe("none");
    expect(capBtn?.style.background).toBe("transparent");
    act(() => {
      capBtn?.click();
    });
    expect(onOpenTab).toHaveBeenCalledWith("corehub");

    const schedBtn = buttons.find((b) => b.textContent?.includes("Scheduled jobs"));
    expect(schedBtn).toBeDefined();
    expect(schedBtn?.style.borderStyle).toBe("none");
    expect(schedBtn?.style.background).toBe("transparent");
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
    expect(newChatBtn).toBeDefined();
    expect(newChatBtn?.style.borderStyle).toBe("none");
    expect(newChatBtn?.style.background).toBe("transparent");

    const kbd = newChatBtn?.querySelector("kbd");
    expect(kbd).not.toBeNull();
    expect(kbd?.style.borderStyle).toBe("none");
    expect(kbd?.style.background).toBe("transparent");

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

  describe("AGENTS Mode & Context Menu", () => {
    const mockAgents = [
      {
        id: "agent_coreblow",
        name: "CoreBlow",
        tagline: "Primary assistant",
        accentColor: "#2DD4BF",
        updatedAt: Date.now(),
        messages: [],
        pinned: true,
      },
      {
        id: "agent_coder",
        name: "Specialist Coder",
        tagline: "TypeScript architect",
        accentColor: "#38BDF8",
        updatedAt: Date.now() - 5000,
        messages: [],
        sectionId: "sec-dev",
        lastSessionId: "thread-1",
      },
      {
        id: "agent_researcher",
        name: "Specialist Researcher",
        tagline: "Deep research",
        accentColor: "#8B5CF6",
        updatedAt: Date.now() - 10000,
        messages: [],
        hidden: true,
      },
    ];

    const mockSections = [
      {
        id: "sec-dev",
        name: "Development",
        collapsed: false,
        createdAt: Date.now() - 20000,
      },
    ];

    it("opens '+' dropdown popover in AGENT mode and triggers modal creation flows", () => {
      const onCreateAgentModal = vi.fn();
      const onCreateGroupChatModal = vi.fn();
      const onCreateSectionModal = vi.fn();

      act(() => {
        root.render(
          <Sidebar
            {...defaultProps}
            activeMode="agent"
            agents={mockAgents}
            onCreateAgentModal={onCreateAgentModal}
            onCreateGroupChatModal={onCreateGroupChatModal}
            onCreateSectionModal={onCreateSectionModal}
          />,
        );
      });

      const plusBtn = container.querySelector('button[aria-label="Create new agent"]') as HTMLButtonElement;
      expect(plusBtn).not.toBeNull();

      // Initially closed
      expect(container.textContent).not.toContain("New group chat");

      // Click to open
      act(() => {
        plusBtn.click();
      });

      expect(container.textContent).toContain("New agent");
      expect(container.textContent).toContain("New group chat");
      expect(container.textContent).toContain("New section");

      // Click "New agent"
      const newAgentOption = Array.from(container.querySelectorAll("div")).find(
        (el) => el.textContent?.trim() === "New agent",
      );
      expect(newAgentOption).toBeDefined();
      act(() => {
        newAgentOption?.click();
      });
      expect(onCreateAgentModal).toHaveBeenCalledTimes(1);
      // Dropdown closes
      expect(container.textContent).not.toContain("New group chat");

      // Re-open and click "New group chat"
      act(() => {
        plusBtn.click();
      });
      const newGroupOption = Array.from(container.querySelectorAll("div")).find(
        (el) => el.textContent?.trim() === "New group chat",
      );
      act(() => {
        newGroupOption?.click();
      });
      expect(onCreateGroupChatModal).toHaveBeenCalledTimes(1);

      // Re-open and click "New section"
      act(() => {
        plusBtn.click();
      });
      const newSectionOption = Array.from(container.querySelectorAll("div")).find(
        (el) => el.textContent?.trim() === "New section",
      );
      act(() => {
        newSectionOption?.click();
      });
      expect(onCreateSectionModal).toHaveBeenCalledTimes(1);

      // Re-open and press Escape
      act(() => {
        plusBtn.click();
      });
      expect(container.textContent).toContain("New section");
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      });
      expect(container.textContent).not.toContain("New section");
    });

    it("opens right-click context menu with all 12 CoreBlow actions and zero bot labels", () => {
      const onEditAgent = vi.fn();
      const onDuplicateAgent = vi.fn();
      const onTogglePinAgent = vi.fn();
      const onToggleHideAgent = vi.fn();
      const onToggleAutoOpenScreen = vi.fn();
      const onOpenScreen = vi.fn();
      const onNewChatWithAgent = vi.fn();
      const onOpenRecentSession = vi.fn();
      const onManageGroups = vi.fn();

      act(() => {
        root.render(
          <Sidebar
            {...defaultProps}
            activeMode="agent"
            agents={mockAgents}
            agentSections={mockSections}
            onEditAgent={onEditAgent}
            onDuplicateAgent={onDuplicateAgent}
            onTogglePinAgent={onTogglePinAgent}
            onToggleHideAgent={onToggleHideAgent}
            onToggleAutoOpenScreen={onToggleAutoOpenScreen}
            onOpenScreen={onOpenScreen}
            onNewChatWithAgent={onNewChatWithAgent}
            onOpenRecentSession={onOpenRecentSession}
            onManageGroups={onManageGroups}
          />,
        );
      });

      // Find the row for Specialist Coder
      const coderRow = Array.from(container.querySelectorAll("div")).find(
        (el) => el.textContent?.includes("Specialist Coder") && el.style.cursor === "pointer",
      );
      expect(coderRow).toBeDefined();

      // Trigger right click (contextmenu)
      act(() => {
        coderRow?.dispatchEvent(
          new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: 120,
            clientY: 240,
          }),
        );
      });

      // Context menu must appear
      expect(container.textContent).toContain("Open agent chat");
      expect(container.textContent).toContain("Open agent chat in new tab");
      expect(container.textContent).toContain("Open Screen");
      expect(container.textContent).toContain("Open Screen when the agent uses it");
      expect(container.textContent).toContain("Pin to top");
      expect(container.textContent).toContain("Hide");
      expect(container.textContent).toContain("Edit...");
      expect(container.textContent).toContain("Manage groups...");
      expect(container.textContent).toContain("Duplicate");
      expect(container.textContent).toContain("New chat with this agent");
      expect(container.textContent).toContain("Open recent session");
      expect(container.textContent).toContain("Move to section");

      // Verify Brand Sovereignty: absolutely ZERO "bot" anywhere
      const lowerText = container.textContent?.toLowerCase() || "";
      expect(lowerText.includes("bot")).toBe(false);

      // Click "Edit..."
      const editBtn = Array.from(container.querySelectorAll("div")).find(
        (el) => el.textContent?.trim() === "Edit...",
      );
      expect(editBtn).toBeDefined();
      act(() => {
        editBtn?.click();
      });
      expect(onEditAgent).toHaveBeenCalledWith(
        expect.objectContaining({ id: "agent_coder", name: "Specialist Coder" }),
      );

      // Re-trigger context menu and test "Duplicate"
      act(() => {
        coderRow?.dispatchEvent(
          new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: 120,
            clientY: 240,
          }),
        );
      });
      const dupBtn = Array.from(container.querySelectorAll("div")).find(
        (el) => el.textContent?.trim() === "Duplicate",
      );
      act(() => {
        dupBtn?.click();
      });
      expect(onDuplicateAgent).toHaveBeenCalledWith(
        expect.objectContaining({ id: "agent_coder" }),
      );

      // Re-trigger context menu and test "Pin to top"
      act(() => {
        coderRow?.dispatchEvent(
          new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: 120,
            clientY: 240,
          }),
        );
      });
      const pinBtn = Array.from(container.querySelectorAll("div")).find(
        (el) => el.textContent?.trim() === "Pin to top",
      );
      act(() => {
        pinBtn?.click();
      });
      expect(onTogglePinAgent).toHaveBeenCalledWith(
        expect.objectContaining({ id: "agent_coder" }),
      );

      // Re-trigger context menu and test "Open Screen"
      act(() => {
        coderRow?.dispatchEvent(
          new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: 120,
            clientY: 240,
          }),
        );
      });
      const screenBtn = Array.from(container.querySelectorAll("div")).find(
        (el) => el.textContent?.trim() === "Open Screen",
      );
      act(() => {
        screenBtn?.click();
      });
      expect(onOpenScreen).toHaveBeenCalledWith(
        expect.objectContaining({ id: "agent_coder" }),
      );

      // Re-trigger context menu and test "Open Screen when the agent uses it"
      act(() => {
        coderRow?.dispatchEvent(
          new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: 120,
            clientY: 240,
          }),
        );
      });
      const autoScreenSpan = Array.from(container.querySelectorAll("span")).find(
        (el) => el.textContent?.trim() === "Open Screen when the agent uses it",
      );
      expect(autoScreenSpan).toBeDefined();
      act(() => {
        autoScreenSpan?.click();
      });
      expect(onToggleAutoOpenScreen).toHaveBeenCalledWith(
        expect.objectContaining({ id: "agent_coder" }),
      );

      // Re-trigger context menu and test "Escape" dismisses it
      act(() => {
        coderRow?.dispatchEvent(
          new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: 120,
            clientY: 240,
          }),
        );
      });
      expect(container.textContent).toContain("Open agent chat");
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      });
      expect(container.textContent).not.toContain("Open agent chat");
    });

    it("renders collapsible sections and toggles hidden agents", () => {
      const onToggleSectionCollapse = vi.fn();

      act(() => {
        root.render(
          <Sidebar
            {...defaultProps}
            activeMode="agent"
            agents={mockAgents}
            agentSections={mockSections}
            onToggleSectionCollapse={onToggleSectionCollapse}
          />,
        );
      });

      // Section header "Development" rendered
      expect(container.textContent).toContain("Development");
      expect(container.textContent).toContain("Specialist Coder");

      // Collapsing section
      const devSectionSpan = Array.from(container.querySelectorAll("span")).find(
        (el) => el.textContent?.trim() === "Development",
      );
      expect(devSectionSpan).toBeDefined();
      act(() => {
        devSectionSpan?.click();
      });
      expect(onToggleSectionCollapse).toHaveBeenCalledWith("sec-dev");

      // Hidden agent toggle pill: Specialist Researcher is hidden
      expect(container.textContent).toContain("Hidden (1)");
      expect(container.textContent).not.toContain("Specialist Researcher");

      const hiddenPill = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Hidden (1)"),
      );
      expect(hiddenPill).toBeDefined();

      // Click Hidden (1) to show hidden agents
      act(() => {
        hiddenPill?.click();
      });
      expect(container.textContent).toContain("Specialist Researcher");
    });
  });
});
