import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: {
    getAppPath: () => process.cwd(),
    getPath: () => "/tmp",
    getVersion: () => "2.2.0",
    isPackaged: false,
  },
  ipcMain: {
    handle: vi.fn(),
  },
}));

import {
  createUpdaterController,
  formatUpdateStatusLabel,
  type AutoUpdaterLike,
  type UpdateStatus,
} from "../../electron/updater";
import { UpdateBanner } from "../components/UpdateBanner";

function createFakeAutoUpdater() {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  const emit = (event: string, ...args: unknown[]) => {
    for (const listener of listeners.get(event) ?? []) {
      listener(...args);
    }
  };

  const api: AutoUpdaterLike & { emit: typeof emit } = {
    autoDownload: true,
    autoInstallOnAppQuit: false,
    on(event, listener) {
      const existing = listeners.get(event) ?? [];
      existing.push(listener);
      listeners.set(event, existing);
      return api;
    },
    checkForUpdates: vi.fn(async () => {
      emit("checking-for-update");
      return null;
    }),
    downloadUpdate: vi.fn(async () => {
      emit("download-progress", { percent: 64.4 });
      emit("update-downloaded", { version: "2.3.0" });
      return null;
    }),
    quitAndInstall: vi.fn(),
    emit,
  };

  return api;
}

describe("Auto-updater controller", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("handles unpackaged builds gracefully without failing", async () => {
    const controller = createUpdaterController({
      currentVersion: "2.2.0",
      isPackaged: false,
      autoUpdater: null,
      prefsStore: {
        loadAutoCheck: () => true,
        saveAutoCheck: vi.fn(),
      },
    });

    const result = await controller.checkForUpdates({ manual: true });
    expect(result.phase).toBe("not-available");
    expect(result.supported).toBe(false);
    expect(formatUpdateStatusLabel(result)).toBe("Up to date");
    controller.dispose();
  });

  it("tracks available -> downloading -> downloaded -> quitAndInstall and persists autoCheck", async () => {
    let savedAutoCheck = true;
    const events: UpdateStatus[] = [];
    const fake = createFakeAutoUpdater();

    const controller = createUpdaterController({
      currentVersion: "2.2.0",
      isPackaged: true,
      autoUpdater: fake,
      prefsStore: {
        loadAutoCheck: () => savedAutoCheck,
        saveAutoCheck: (next) => {
          savedAutoCheck = next;
        },
      },
      onStatusChange: (s) => events.push(s),
    });

    expect(fake.autoDownload).toBe(false);
    expect(fake.autoInstallOnAppQuit).toBe(true);

    const toggled = controller.setAutoCheck(false);
    expect(toggled.autoCheckEnabled).toBe(false);
    expect(savedAutoCheck).toBe(false);

    fake.checkForUpdates = vi.fn(async () => {
      fake.emit("checking-for-update");
      fake.emit("update-available", { version: "2.3.0", releaseNotes: "Desktop tray" });
    });

    const checked = await controller.checkForUpdates({ manual: true });
    expect(checked.phase).toBe("available");
    expect(checked.availableVersion).toBe("2.3.0");
    expect(formatUpdateStatusLabel(checked)).toBe("Update v2.3.0 available");

    const downloaded = await controller.downloadUpdate();
    expect(downloaded.phase).toBe("downloaded");
    expect(downloaded.progressPercent).toBe(100);
    expect(controller.quitAndInstall()).toBe(true);
    expect(fake.quitAndInstall).toHaveBeenCalledWith(false, true);

    expect(events.some((e) => e.phase === "downloading" && e.progressPercent === 64)).toBe(true);
    controller.dispose();
  });

  it("handles offline manual errors cleanly without throwing", async () => {
    const fake = createFakeAutoUpdater();
    fake.checkForUpdates = vi.fn(async () => {
      throw new Error("net::ERR_INTERNET_DISCONNECTED");
    });

    const controller = createUpdaterController({
      currentVersion: "2.2.0",
      isPackaged: true,
      autoUpdater: fake,
      prefsStore: {
        loadAutoCheck: () => false,
        saveAutoCheck: vi.fn(),
      },
    });

    const offlineStatus = await controller.checkForUpdates({ manual: true });
    expect(offlineStatus.phase).toBe("error");
    expect(offlineStatus.error).toContain("ERR_INTERNET_DISCONNECTED");
    expect(formatUpdateStatusLabel(offlineStatus)).toContain("Offline");
    controller.dispose();
  });
});

describe("UpdateBanner UI", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
      root = null;
    }
    container?.remove();
    container = null;
  });

  it("renders update notification actions when an update is available and hides when dismissed", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    const onDownloadAndRestart = vi.fn();
    const onDismiss = vi.fn();

    const availableStatus: UpdateStatus = {
      phase: "available",
      currentVersion: "2.2.0",
      availableVersion: "2.3.0",
      autoCheckEnabled: true,
      supported: true,
    };

    act(() => {
      root!.render(
        React.createElement(UpdateBanner, {
          status: availableStatus,
          dismissedVersion: null,
          onDownloadAndRestart,
          onInstallNow: vi.fn(),
          onDismiss,
        }),
      );
    });

    expect(container.textContent).toContain("CoreBlow v2.3.0 is available");
    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons.map((b) => b.textContent)).toEqual(["Download & Restart", "Later"]);

    act(() => {
      buttons[0].click();
      buttons[1].click();
    });
    expect(onDownloadAndRestart).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    act(() => {
      root!.render(
        React.createElement(UpdateBanner, {
          status: availableStatus,
          dismissedVersion: "2.3.0",
          onDownloadAndRestart,
          onInstallNow: vi.fn(),
          onDismiss,
        }),
      );
    });
    expect(container.querySelector('[data-testid="update-banner"]')).toBeNull();
  });
});
