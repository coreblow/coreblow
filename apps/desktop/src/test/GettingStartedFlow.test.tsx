import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { GettingStartedFlow, type GettingStartedFlowProps } from "../components/GettingStartedFlow";

// Enable React act environment in jsdom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("GettingStartedFlow Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  const createProps = (overrides?: Partial<GettingStartedFlowProps>): GettingStartedFlowProps => ({
    userName: "",
    onUpdateUserName: vi.fn(),
    accentColor: "#2DD4BF",
    onUpdateAccentColor: vi.fn(),
    themeMode: "dark",
    onUpdateThemeMode: vi.fn(),
    layoutMode: "basic",
    onUpdateLayoutMode: vi.fn(),
    onSaveApiKey: vi.fn(),
    onFinish: vi.fn(),
    onSkip: vi.fn(),
    ...overrides,
  });

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

  it("renders Step 1 with user name prompt and input", () => {
    const props = createProps();
    act(() => {
      root.render(<GettingStartedFlow {...props} />);
    });

    expect(container.textContent).toContain("Welcome to CoreBlow");
    expect(container.textContent).toContain("What should I call you?");
    expect(container.querySelector("input")).toBeDefined();
    expect(container.textContent).toContain("Skip setup");
  });

  it("calls onSkip when Skip setup header button is clicked", () => {
    const props = createProps();
    act(() => {
      root.render(<GettingStartedFlow {...props} />);
    });

    const skipBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Skip setup"),
    );
    expect(skipBtn).toBeDefined();

    act(() => {
      skipBtn?.click();
    });

    expect(props.onSkip).toHaveBeenCalledTimes(1);
  });

  it("updates name and progresses to Step 2 (Theme & Accent)", () => {
    const props = createProps();
    act(() => {
      root.render(<GettingStartedFlow {...props} />);
    });

    const input = container.querySelector("input") as HTMLInputElement;
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    act(() => {
      nativeSetter?.call(input, "Alex");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const continueBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Continue →"),
    );

    act(() => {
      continueBtn?.click();
    });

    expect(props.onUpdateUserName).toHaveBeenCalledWith("Alex");
    expect(container.textContent).toContain("Pick a colour and appearance");
    expect(container.textContent).toContain("Accent Colour");
    expect(container.textContent).toContain("Theme Mode");
  });

  it("progresses through Step 3 (Workspace mode) and Step 4 (AI connection)", () => {
    const props = createProps({ userName: "Alex" });
    act(() => {
      root.render(<GettingStartedFlow {...props} />);
    });

    // Step 1 -> Step 2
    const step1Btn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Continue →"),
    );
    act(() => {
      step1Btn?.click();
    });

    // Step 2 -> Step 3
    const step2Btn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Continue →"),
    );
    act(() => {
      step2Btn?.click();
    });

    expect(container.textContent).toContain("Which layout suits your daily workflow?");
    expect(container.textContent).toContain("Basic");
    expect(container.textContent).toContain("Pro");

    // Select Pro Workspace
    const proCard = container.querySelector('[data-testid="pro-card"]') as HTMLElement;
    expect(proCard).toBeDefined();
    act(() => {
      proCard?.click();
    });
    expect(props.onUpdateLayoutMode).toHaveBeenCalledWith("pro");

    // Step 3 -> Step 4
    const step3Btn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Continue →"),
    );
    act(() => {
      step3Btn?.click();
    });

    expect(container.textContent).toContain("Connect an AI model backend");
    expect(container.textContent).toContain("Finish & Start →");

    // Click Finish & Start
    const finishBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Finish & Start →"),
    );
    act(() => {
      finishBtn?.click();
    });

    expect(props.onFinish).toHaveBeenCalledTimes(1);
  });
});
