import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: {
    getAppPath: () => process.cwd(),
  },
  Menu: {
    buildFromTemplate: vi.fn((template) => template),
  },
  nativeImage: {
    createFromPath: vi.fn(() => ({ isEmpty: () => false, setTemplateImage: vi.fn() })),
    createEmpty: vi.fn(() => ({ isEmpty: () => true, setTemplateImage: vi.fn() })),
  },
  Tray: vi.fn(),
}));

import { buildTrayMenuTemplate, resolveTrayIconRelativePath } from "../../electron/tray";

describe("Tray menu controller helpers", () => {
  it("selects platform-appropriate tray icon path", () => {
    expect(resolveTrayIconRelativePath("darwin")).toBe("assets/icons/trayTemplate.png");
    expect(resolveTrayIconRelativePath("win32")).toBe("assets/icons/tray-color.png");
    expect(resolveTrayIconRelativePath("linux")).toBe("assets/icons/tray-color.png");
  });

  it("renders Gateway Online / Offline status label and wires all actions", () => {
    const handlers = {
      onOpenWindow: vi.fn(),
      onNewChat: vi.fn(),
      onRestartGateway: vi.fn(),
      onCheckForUpdates: vi.fn(),
      onQuit: vi.fn(),
    };

    const onlineTemplate = buildTrayMenuTemplate({ gatewayOnline: true }, handlers);
    expect(onlineTemplate[0]).toMatchObject({
      label: "CoreBlow Gateway: Online",
      enabled: false,
    });

    const offlineTemplate = buildTrayMenuTemplate({ gatewayOnline: false }, handlers);
    expect(offlineTemplate[0]).toMatchObject({
      label: "CoreBlow Gateway: Offline",
      enabled: false,
    });

    const labels = onlineTemplate.filter((item) => item.label).map((item) => item.label);
    expect(labels).toEqual([
      "CoreBlow Gateway: Online",
      "Open CoreBlow",
      "New Chat",
      "Restart Gateway",
      "Check for Updates",
      "Quit CoreBlow",
    ]);

    for (const item of onlineTemplate) {
      if (item.label === "New Chat" && item.click) {
        (item.click as () => void)();
      }
      if (item.label === "Check for Updates" && item.click) {
        (item.click as () => void)();
      }
      if (item.label === "Quit CoreBlow" && item.click) {
        (item.click as () => void)();
      }
    }

    expect(handlers.onNewChat).toHaveBeenCalledTimes(1);
    expect(handlers.onCheckForUpdates).toHaveBeenCalledTimes(1);
    expect(handlers.onQuit).toHaveBeenCalledTimes(1);
  });
});
