import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ConversationArea } from "../components/ConversationArea";
import type { ChatMessage } from "../types/gateway";

// Enable React act environment in jsdom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("ConversationArea Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  const baseProps = {
    messages: [] as ChatMessage[],
    prompt: "",
    onChangePrompt: vi.fn(),
    onSend: vi.fn(),
    onStop: vi.fn(),
    isStreaming: false,
    permissionMode: "Guarded" as const,
    onChangePermissionMode: vi.fn(),
    modelTier: "High Reasoning" as const,
    onChangeModelTier: vi.fn(),
    attachedFiles: [],
    onAddFiles: vi.fn(),
    onRemoveFile: vi.fn(),
    projectName: "coreblow",
    projectBranch: "main",
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

  it("renders Centered Hero Empty State when messages is empty", () => {
    act(() => {
      root.render(<ConversationArea {...baseProps} messages={[]} />);
    });
    expect(container.textContent).toContain("CoreBlow");
    expect(container.textContent).not.toContain("CoreBlow Studio");
    expect(container.textContent).toContain("v2.0");
    // Verify old suggestion cards are removed
    expect(container.textContent).not.toContain("Run Verification Gates");
    expect(container.textContent).not.toContain("Inspect Cory Memory");
  });

  it("renders message bubbles when messages is not empty", () => {
    const messages: ChatMessage[] = [
      {
        id: "msg-1",
        role: "user",
        content: "Hello CoreBlow!",
        timestamp: Date.now(),
      },
      {
        id: "msg-2",
        role: "assistant",
        content: "Greetings! How can I assist you with your project today?",
        timestamp: Date.now() + 1,
      },
    ];

    act(() => {
      root.render(<ConversationArea {...baseProps} messages={messages} />);
    });
    expect(container.textContent).toContain("Hello CoreBlow!");
    expect(container.textContent).toContain("Greetings! How can I assist you with your project today?");
  });
});
