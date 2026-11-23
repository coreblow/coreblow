import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { InspectorDrawer, type InspectorTab } from "../components/InspectorDrawer";
import type { ActiveProjectState } from "../types/gateway";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("InspectorDrawer Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockProject: ActiveProjectState = {
    path: "/Users/febrinanda/coreblow",
    name: "coreblow",
    branch: "main",
    isGit: true,
    uncommittedFiles: 3,
  };

  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    activeTab: "start" as InspectorTab,
    onChangeTab: vi.fn(),
    project: mockProject,
    onAttachFile: vi.fn(),
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

  it("renders Start Launcher home with all 4 tactile action cards and shortcuts", () => {
    act(() => {
      root.render(<InspectorDrawer {...defaultProps} />);
    });

    expect(container.textContent).toContain("Start");
    expect(container.textContent).toContain("Workspace files");
    expect(container.textContent).toContain("⌘P");
    expect(container.textContent).toContain("New terminal ▾");
    expect(container.textContent).toContain("⌃`");
    expect(container.textContent).toContain("Browser");
    expect(container.textContent).toContain("⌘T");
    expect(container.textContent).toContain("More tools");
  });

  it("navigates to files, terminal, and browser when clicking tactile cards", () => {
    const onChangeTab = vi.fn();
    act(() => {
      root.render(<InspectorDrawer {...defaultProps} onChangeTab={onChangeTab} />);
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const filesCard = buttons.find((b) => b.textContent?.includes("Workspace files"));
    expect(filesCard).toBeDefined();
    act(() => {
      filesCard?.click();
    });
    expect(onChangeTab).toHaveBeenCalledWith("files");

    const terminalCard = buttons.find((b) => b.textContent?.includes("New terminal ▾"));
    expect(terminalCard).toBeDefined();
    act(() => {
      terminalCard?.click();
    });
    expect(onChangeTab).toHaveBeenCalledWith("terminal");

    const browserCard = buttons.find((b) => b.textContent?.includes("Browser"));
    expect(browserCard).toBeDefined();
    act(() => {
      browserCard?.click();
    });
    expect(onChangeTab).toHaveBeenCalledWith("browser");
  });

  it("expands More tools to reveal all 4 CoreBlow instruments", () => {
    const onChangeTab = vi.fn();
    act(() => {
      root.render(<InspectorDrawer {...defaultProps} onChangeTab={onChangeTab} />);
    });

    expect(container.textContent).not.toContain("Git Gates");
    expect(container.textContent).not.toContain("Agent Squad");
    expect(container.textContent).not.toContain("Cory Memory");
    expect(container.textContent).not.toContain("CoreHub");

    const buttons = Array.from(container.querySelectorAll("button"));
    const moreToolsBtn = buttons.find((b) => b.textContent?.includes("More tools"));
    expect(moreToolsBtn).toBeDefined();

    act(() => {
      moreToolsBtn?.click();
    });

    expect(container.textContent).toContain("Git Gates");
    expect(container.textContent).toContain("Agent Squad");
    expect(container.textContent).toContain("Cory Memory");
    expect(container.textContent).toContain("CoreHub");

    const updatedButtons = Array.from(container.querySelectorAll("button"));
    const warRoomBtn = updatedButtons.find((b) => b.textContent?.includes("Agent Squad"));
    act(() => {
      warRoomBtn?.click();
    });
    expect(onChangeTab).toHaveBeenCalledWith("warroom");
  });

  it("renders Workspace files tab with search, copy, and attach actions", () => {
    const onAttachFile = vi.fn();
    act(() => {
      root.render(
        <InspectorDrawer
          {...defaultProps}
          activeTab="files"
          onAttachFile={onAttachFile}
        />,
      );
    });

    expect(container.textContent).toContain("coreblow");
    expect(container.textContent).toContain("branch: main");
    expect(container.textContent).toContain("coreblow-react-engine.ts");

    const attachButtons = Array.from(container.querySelectorAll("button")).filter(
      (b) => b.textContent?.includes("Attach"),
    );
    expect(attachButtons.length).toBeGreaterThan(0);
    act(() => {
      attachButtons[0]?.click();
    });
    expect(onAttachFile).toHaveBeenCalled();
  });

  it("returns to Start Launcher home view when clicking header back button", () => {
    const onChangeTab = vi.fn();
    act(() => {
      root.render(
        <InspectorDrawer
          {...defaultProps}
          activeTab="terminal"
          onChangeTab={onChangeTab}
        />,
      );
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const backBtn = buttons.find((b) => b.textContent?.includes("Start"));
    expect(backBtn).toBeDefined();

    act(() => {
      backBtn?.click();
    });
    expect(onChangeTab).toHaveBeenCalledWith("start");
  });
});
