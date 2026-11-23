import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { LocalTerminalTab } from "../components/tabs/LocalTerminalTab";
import type { ActiveProjectState } from "../types/gateway";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("LocalTerminalTab Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockProject: ActiveProjectState = {
    path: "/Users/febrinanda/coreblow",
    name: "coreblow",
    branch: "main",
    isGit: true,
    uncommittedFiles: 2,
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
    delete (window as any).coreblowDesktop;
  });

  it("renders connected local terminal greeting and workspace path", async () => {
    (window as any).coreblowDesktop = {
      terminal: {
        getInfo: vi.fn().mockResolvedValue({
          shell: "/bin/zsh",
          cwd: "/Users/febrinanda/coreblow",
          username: "febrinanda",
          hostname: "MacBook-Pro",
          platform: "darwin",
        }),
        exec: vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 }),
        openExternal: vi.fn().mockResolvedValue(true),
      },
    };

    await act(async () => {
      root.render(<LocalTerminalTab project={mockProject} />);
    });

    expect(container.textContent).toContain("Local Terminal");
    expect(container.textContent).toContain("zsh");
    expect(container.textContent).toContain("coreblow");
    expect(container.textContent).toContain("● Connected to local terminal: zsh (/bin/zsh)");
    expect(container.textContent).toContain("/Users/febrinanda/coreblow");
    expect(container.textContent).toContain("Terminal.app ↗");
  });

  it("executes real commands via desktopApi and displays output", async () => {
    const execMock = vi.fn().mockResolvedValue({
      stdout: "apps/\ndocs/\npackage.json\n",
      stderr: "",
      exitCode: 0,
    });

    (window as any).coreblowDesktop = {
      terminal: {
        getInfo: vi.fn().mockResolvedValue({
          shell: "/bin/zsh",
          cwd: "/Users/febrinanda/coreblow",
          username: "febrinanda",
          hostname: "MacBook-Pro",
          platform: "darwin",
        }),
        exec: execMock,
        openExternal: vi.fn().mockResolvedValue(true),
      },
    };

    await act(async () => {
      root.render(<LocalTerminalTab project={mockProject} />);
    });

    const input = container.querySelector("input") as HTMLInputElement;
    expect(input).toBeDefined();

    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set?.call(input, "ls");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const form = container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(execMock).toHaveBeenCalledWith("ls", "/Users/febrinanda/coreblow");
    expect(container.textContent).toContain("apps/");
    expect(container.textContent).toContain("package.json");
  });

  it("launches native macOS Terminal.app when clicking Terminal.app ↗ button", async () => {
    const openExternalMock = vi.fn().mockResolvedValue(true);

    (window as any).coreblowDesktop = {
      terminal: {
        getInfo: vi.fn().mockResolvedValue({
          shell: "/bin/zsh",
          cwd: "/Users/febrinanda/coreblow",
          username: "febrinanda",
          hostname: "MacBook-Pro",
          platform: "darwin",
        }),
        exec: vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 }),
        openExternal: openExternalMock,
      },
    };

    await act(async () => {
      root.render(<LocalTerminalTab project={mockProject} />);
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const termAppBtn = buttons.find((b) => b.textContent?.includes("Terminal.app ↗"));
    expect(termAppBtn).toBeDefined();

    await act(async () => {
      termAppBtn?.click();
    });

    expect(openExternalMock).toHaveBeenCalledWith("/Users/febrinanda/coreblow");
    expect(container.textContent).toContain("Launched macOS native Terminal.app");
  });

  it("clears terminal output when clicking Clear button", async () => {
    (window as any).coreblowDesktop = {
      terminal: {
        getInfo: vi.fn().mockResolvedValue({
          shell: "/bin/zsh",
          cwd: "/Users/febrinanda/coreblow",
          username: "febrinanda",
          hostname: "MacBook-Pro",
          platform: "darwin",
        }),
        exec: vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 }),
        openExternal: vi.fn().mockResolvedValue(true),
      },
    };

    await act(async () => {
      root.render(<LocalTerminalTab project={mockProject} />);
    });

    expect(container.textContent).toContain("Connected to local terminal");

    const buttons = Array.from(container.querySelectorAll("button"));
    const clearBtn = buttons.find((b) => b.textContent?.includes("Clear"));
    expect(clearBtn).toBeDefined();

    act(() => {
      clearBtn?.click();
    });

    expect(container.textContent).not.toContain("Connected to local terminal");
  });
});
