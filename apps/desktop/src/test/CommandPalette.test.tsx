import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CommandPalette, type CommandPaletteProps } from "../components/CommandPalette";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("CommandPalette Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  const defaultProps: CommandPaletteProps = {
    open: true,
    onClose: vi.fn(),
    threads: [
      { id: "session-1", title: "Refactor SQLite Session Store", updatedAt: Date.now() },
      { id: "session-2", title: "Implement Bot Pairing Security", updatedAt: Date.now() },
    ],
    activeThreadId: "session-1",
    onSelectThread: vi.fn(),
    onNewChat: vi.fn(),
    onToggleLayoutMode: vi.fn(),
    layoutMode: "basic",
    onToggleHud: vi.fn(),
    onCaptureScreen: vi.fn(),
    onRollback: vi.fn(),
    onToggleEstop: vi.fn(),
    estopPaused: false,
    onOpenSettings: vi.fn(),
    onSyncSessions: vi.fn(),
    onRunSetupWizard: vi.fn(),
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
    vi.clearAllMocks();
  });

  it("renders when open and displays quick actions and recent sessions", () => {
    act(() => {
      root.render(<CommandPalette {...defaultProps} />);
    });

    expect(container.textContent).toContain("New Chat");
    expect(container.textContent).toContain("Refactor SQLite Session Store");
    expect(container.textContent).toContain("Implement Bot Pairing Security");
  });

  it("does not render when open is false", () => {
    act(() => {
      root.render(<CommandPalette {...defaultProps} open={false} />);
    });

    expect(container.textContent).toBe("");
  });

  it("filters items based on search query", () => {
    act(() => {
      root.render(<CommandPalette {...defaultProps} />);
    });

    const input = container.querySelector("input");
    expect(input).not.toBeNull();

    act(() => {
      if (input) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;
        nativeInputValueSetter?.call(input, "Pairing");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    expect(container.textContent).toContain("Implement Bot Pairing Security");
    expect(container.textContent).not.toContain("Refactor SQLite Session Store");
  });

  it("triggers action on item click and closes palette", () => {
    act(() => {
      root.render(<CommandPalette {...defaultProps} />);
    });

    const newChatElement = Array.from(container.querySelectorAll("div")).find(
      (el) => el.textContent === "New Chat"
    );
    expect(newChatElement).toBeDefined();

    act(() => {
      newChatElement?.click();
    });

    expect(defaultProps.onNewChat).toHaveBeenCalledTimes(1);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });
});
