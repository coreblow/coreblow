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

  it("renders clean sovereign zsh prompt with username, hostname, and project name", async () => {
    (window as any).coreblowDesktop = {
      terminal: {
        getInfo: vi.fn().mockResolvedValue({
          shell: "/bin/zsh",
          cwd: "/Users/febrinanda/coreblow",
          username: "febrinanda",
          hostname: "febrinandas-Mac-mini",
          platform: "darwin",
        }),
        exec: vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 }),
        openExternal: vi.fn().mockResolvedValue(true),
      },
    };

    await act(async () => {
      root.render(<LocalTerminalTab project={mockProject} />);
    });

    expect(container.textContent).toContain("febrinanda@febrinandas-Mac-mini coreblow %");
  });

  it("executes real commands via desktopApi and displays output", async () => {
    const execMock = vi.fn().mockResolvedValue({
      stdout: "apps\ndocs\npackage.json\n",
      stderr: "",
      exitCode: 0,
    });

    (window as any).coreblowDesktop = {
      terminal: {
        getInfo: vi.fn().mockResolvedValue({
          shell: "/bin/zsh",
          cwd: "/Users/febrinanda/coreblow",
          username: "febrinanda",
          hostname: "febrinandas-Mac-mini",
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

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    });

    expect(execMock).toHaveBeenCalledWith("ls", "/Users/febrinanda/coreblow");
    expect(container.textContent).toContain("apps");
    expect(container.textContent).toContain("package.json");
  });

  it("handles Ctrl+C to cancel current line and start a new prompt", async () => {
    (window as any).coreblowDesktop = {
      terminal: {
        getInfo: vi.fn().mockResolvedValue({
          shell: "/bin/zsh",
          cwd: "/Users/febrinanda/coreblow",
          username: "febrinanda",
          hostname: "febrinandas-Mac-mini",
          platform: "darwin",
        }),
        exec: vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 }),
        openExternal: vi.fn().mockResolvedValue(true),
      },
    };

    await act(async () => {
      root.render(<LocalTerminalTab project={mockProject} />);
    });

    const input = container.querySelector("input") as HTMLInputElement;

    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set?.call(input, "sleep 100");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "c", ctrlKey: true, bubbles: true, cancelable: true }),
      );
    });

    expect(container.textContent).toContain("^C");
  });

  it("clears screen when typing 'clear'", async () => {
    (window as any).coreblowDesktop = {
      terminal: {
        getInfo: vi.fn().mockResolvedValue({
          shell: "/bin/zsh",
          cwd: "/Users/febrinanda/coreblow",
          username: "febrinanda",
          hostname: "febrinandas-Mac-mini",
          platform: "darwin",
        }),
        exec: vi.fn().mockResolvedValue({ stdout: "line 1\nline 2", stderr: "", exitCode: 0 }),
        openExternal: vi.fn().mockResolvedValue(true),
      },
    };

    await act(async () => {
      root.render(<LocalTerminalTab project={mockProject} />);
    });

    const input = container.querySelector("input") as HTMLInputElement;

    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set?.call(input, "pwd");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain("line 1");

    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set?.call(input, "clear");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    });

    expect(container.textContent).not.toContain("line 1");
  });
});
