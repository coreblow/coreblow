import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Composer } from "../components/Composer";

// Enable React act environment in jsdom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("Composer Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  const defaultProps = {
    prompt: "",
    onChangePrompt: vi.fn(),
    onSend: vi.fn(),
    onStop: vi.fn(),
    isStreaming: false,
    permissionMode: "Guarded" as const,
    onChangePermissionMode: vi.fn(),
    modelTier: "High Reasoning" as const,
    onChangeModelTier: vi.fn(),
    activeModel: "Auto (DecisionRouter)",
    onChangeActiveModel: vi.fn(),
    agentTeamwork: false,
    onToggleAgentTeamwork: vi.fn(),
    executionMode: "standard" as const,
    onChangeExecutionMode: vi.fn(),
    attachedFiles: [],
    onAddFiles: vi.fn(),
    onRemoveFile: vi.fn(),
    projectName: "coreblow",
    projectBranch: "main",
    onSelectWorkspace: vi.fn(),
    autoSpeak: false,
    onToggleAutoSpeak: vi.fn(),
    isSpeaking: false,
    onStopSpeaking: vi.fn(),
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

  it("renders Above-Composer workspace and mode bar", () => {
    act(() => {
      root.render(<Composer {...defaultProps} />);
    });
    expect(container.textContent).toContain("coreblow");
    expect(container.textContent).toContain(":main");
    expect(container.textContent).toContain("Standard mode");
  });

  it("renders textarea with new placeholder", () => {
    act(() => {
      root.render(<Composer {...defaultProps} />);
    });
    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();
    expect(textarea?.placeholder).toBe(
      "Describe what you want to build, / commands, @ files or sessions",
    );
  });

  it("renders unified model and effort pill", () => {
    act(() => {
      root.render(<Composer {...defaultProps} />);
    });
    expect(container.textContent).toContain("coreblow/balanced");
    expect(container.textContent).toContain("High");
  });

  it("opens unified model/effort/teamwork popover on pill click and closes on Escape", () => {
    act(() => {
      root.render(<Composer {...defaultProps} />);
    });

    // Find pill button
    const buttons = Array.from(container.querySelectorAll("button"));
    const pillButton = buttons.find((b) => b.textContent?.includes("coreblow/balanced"));
    expect(pillButton).toBeDefined();

    // Popover initially not rendered
    expect(container.textContent).not.toContain("Enable agent teamwork");

    // Click pill to open popover
    act(() => {
      pillButton?.click();
    });
    expect(container.textContent).toContain("Enable agent teamwork");
    expect(container.textContent).toContain("Effort");
    expect(container.textContent).toContain("Low");
    expect(container.textContent).toContain("Medium");
    expect(container.textContent).toContain("High");

    // Press Escape to close popover
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(container.textContent).not.toContain("Enable agent teamwork");
  });

  it("toggles agent teamwork switch in popover", () => {
    const onToggleAgentTeamwork = vi.fn();
    act(() => {
      root.render(
        <Composer {...defaultProps} onToggleAgentTeamwork={onToggleAgentTeamwork} />,
      );
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const pillButton = buttons.find((b) => b.textContent?.includes("coreblow/balanced"));
    act(() => {
      pillButton?.click();
    });

    const toggleBtn = container.querySelector('button[aria-label="Toggle agent teamwork"]');
    expect(toggleBtn).not.toBeNull();
    act(() => {
      (toggleBtn as HTMLButtonElement)?.click();
    });

    expect(onToggleAgentTeamwork).toHaveBeenCalledWith(true);
  });

  it("switches execution mode and engages agent teamwork when selecting War Room Squad", () => {
    const onChangeExecutionMode = vi.fn();
    const onToggleAgentTeamwork = vi.fn();
    act(() => {
      root.render(
        <Composer
          {...defaultProps}
          onChangeExecutionMode={onChangeExecutionMode}
          onToggleAgentTeamwork={onToggleAgentTeamwork}
        />,
      );
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const modeBtn = buttons.find((b) => b.textContent?.includes("Standard mode"));
    expect(modeBtn).toBeDefined();

    act(() => {
      modeBtn?.click();
    });

    const squadButtons = Array.from(container.querySelectorAll("button"));
    const warRoomOption = squadButtons.find((b) => b.textContent?.includes("War Room Squad"));
    expect(warRoomOption).toBeDefined();

    act(() => {
      warRoomOption?.click();
    });

    expect(onChangeExecutionMode).toHaveBeenCalledWith("warroom");
    expect(onToggleAgentTeamwork).toHaveBeenCalledWith(true);
  });
});
