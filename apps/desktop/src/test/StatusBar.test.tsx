import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StatusBar } from "../components/StatusBar";

// Enable React act environment in jsdom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("StatusBar Component", () => {
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

  it("renders status bar items and responds to layout mode toggle", () => {
    const onToggleLayout = vi.fn();

    act(() => {
      root.render(
        <StatusBar
          gatewayHealthy={true}
          activeNodeName="Local Gateway"
          activeModelName="Auto (DecisionRouter)"
          layoutMode="basic"
          onToggleLayoutMode={onToggleLayout}
          version="v2.4.0"
        />,
      );
    });

    expect(container.textContent).toContain("Local Gateway");
    expect(container.textContent).toContain("Auto (DecisionRouter)");
    expect(container.textContent).toContain("Smart Router");
    expect(container.textContent).toContain("Basic");
    expect(container.textContent).toContain("v2.4.0");

    const layoutBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Basic"),
    );
    expect(layoutBtn).toBeDefined();

    act(() => {
      layoutBtn?.click();
    });

    expect(onToggleLayout).toHaveBeenCalledTimes(1);
  });
});
