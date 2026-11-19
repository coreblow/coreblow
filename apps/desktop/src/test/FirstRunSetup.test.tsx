import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { FirstRunSetup } from "../components/FirstRunSetup";
import { gatewayClient } from "../services/gateway-client";

// Enable React act environment in jsdom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("FirstRunSetup Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    vi.spyOn(gatewayClient, "checkHealth").mockResolvedValue(true);
    vi.spyOn(gatewayClient, "getCoryProfile").mockResolvedValue({
      totalMemories: 5,
      layers: { identity: 2, project: 1, preferences: 1, dynamic: 1 },
    });
    vi.spyOn(gatewayClient, "getCredentialPools").mockResolvedValue({
      credentials: [],
    } as any);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it("renders Welcome Splash screen with CoreBlow branding and buttons", () => {
    const onComplete = vi.fn();
    const onSkip = vi.fn();

    act(() => {
      root.render(<FirstRunSetup onComplete={onComplete} onSkip={onSkip} />);
    });

    expect(container.textContent).toContain("COREBLOW");
    expect(container.textContent).toContain("The sovereign AI agent that grows with you");
    expect(container.textContent).toContain("Setup CoreBlow");
    expect(container.textContent).toContain("Skip setup");
  });

  it("calls onSkip when Skip setup is clicked", () => {
    const onComplete = vi.fn();
    const onSkip = vi.fn();

    act(() => {
      root.render(<FirstRunSetup onComplete={onComplete} onSkip={onSkip} />);
    });

    const skipBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Skip setup"),
    );
    expect(skipBtn).toBeDefined();

    act(() => {
      skipBtn?.click();
    });

    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("transitions to live checklist when Setup CoreBlow is clicked", async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const onSkip = vi.fn();

    act(() => {
      root.render(<FirstRunSetup onComplete={onComplete} onSkip={onSkip} />);
    });

    const setupBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Setup CoreBlow"),
    );
    expect(setupBtn).toBeDefined();

    act(() => {
      setupBtn?.click();
    });

    expect(container.textContent).toContain("CoreBlow Setup");
    expect(container.textContent).toContain("System prerequisites");
    expect(container.textContent).toContain("Start Single-Brain Gateway (:18789)");

    vi.useRealTimers();
  });
});
