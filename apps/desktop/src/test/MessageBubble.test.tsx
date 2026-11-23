import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MessageBubble } from "../components/MessageBubble";
import type { ChatMessage } from "../types/gateway";

// Enable React act environment in jsdom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("MessageBubble Component", () => {
  let container: HTMLDivElement;
  let root: Root;

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

  it("renders user message as a right-aligned pill with content", () => {
    const userMessage: ChatMessage = {
      id: "user-1",
      role: "user",
      content: "Explain the CoreBlow microkernel architecture.",
      timestamp: Date.now(),
      attachedFiles: ["/workspace/kernel.ts"],
    };

    act(() => {
      root.render(<MessageBubble message={userMessage} />);
    });

    expect(container.textContent).toContain("Explain the CoreBlow microkernel architecture.");
    expect(container.textContent).toContain("kernel.ts");

    // Verify right-aligned container flex alignment
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.display).toBe("flex");
    expect(wrapper.style.justifyContent).toBe("flex-end");
  });

  it("renders assistant message as plain prose directly on canvas with zero avatar box or emblem", () => {
    const assistantMessage: ChatMessage = {
      id: "asst-1",
      role: "assistant",
      content: "CoreBlow microkernel provides **strict** isolation and zero-copy IPC.",
      timestamp: Date.now(),
    };

    act(() => {
      root.render(<MessageBubble message={assistantMessage} />);
    });

    expect(container.textContent).toContain("CoreBlow microkernel provides");
    expect(container.textContent).toContain("strict");
    expect(container.textContent).toContain("isolation and zero-copy IPC.");

    // Zero avatar box or CoreBlowEmblem SVG
    const svgIcons = container.querySelectorAll("svg");
    // Only copy icon should be present, no emblem icon
    expect(container.querySelector(".coreblow-emblem")).toBeNull();

    // Verify root container has display: block, transparent background, and no border
    const rootEl = container.firstElementChild as HTMLElement;
    expect(rootEl.style.display).toBe("block");
    expect(rootEl.style.background).toBe("transparent");
    expect(rootEl.style.borderStyle).toBe("none");

    // Copy button should be present for non-empty finished assistant message
    const copyButton = container.querySelector('button[aria-label="Copy message"]');
    expect(copyButton).not.toBeNull();
  });

  it("renders assistant error as plain borderless inline text without background box", () => {
    const errorMessage: ChatMessage = {
      id: "asst-err-1",
      role: "assistant",
      content: "",
      error: "Failed to connect to gateway socket",
      timestamp: Date.now(),
    };

    act(() => {
      root.render(<MessageBubble message={errorMessage} />);
    });

    expect(container.textContent).toContain("Error: Failed to connect to gateway socket");

    // Verify error element has no background box, border, or padding
    const errorEl = container.querySelector<HTMLDivElement>(".message-error");
    expect(errorEl).not.toBeNull();
    expect(errorEl?.style.background).toBeFalsy();
    expect(errorEl?.style.border).toBeFalsy();
    expect(errorEl?.style.padding).toBeFalsy();
    expect(errorEl?.style.color).toContain("state-error");
  });

  it("handles copy action on assistant message", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    (window as any).coreblowDesktop = {
      clipboard: {
        writeText: writeTextMock,
      },
    };

    const assistantMessage: ChatMessage = {
      id: "asst-copy",
      role: "assistant",
      content: "Deterministic verified response",
      timestamp: Date.now(),
    };

    act(() => {
      root.render(<MessageBubble message={assistantMessage} />);
    });

    const copyBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Copy message"]');
    expect(copyBtn).not.toBeNull();

    await act(async () => {
      copyBtn?.click();
    });

    expect(writeTextMock).toHaveBeenCalledWith("Deterministic verified response");
    expect(container.textContent).toContain("Copied");
  });
});
