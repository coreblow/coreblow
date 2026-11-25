import { app, Menu, nativeImage, Tray, type MenuItemConstructorOptions } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";

export interface TrayMenuState {
  gatewayOnline: boolean;
}

export interface TrayMenuHandlers {
  onOpenWindow: () => void;
  onNewChat: () => void;
  onRestartGateway: () => void;
  onCheckForUpdates: () => void;
  onQuit: () => void;
}

export interface TrayController {
  setGatewayOnline: (online: boolean) => void;
  destroy: () => void;
}

/**
 * Resolves the tray icon path relative to the desktop package root for each OS.
 */
export function resolveTrayIconRelativePath(platform: NodeJS.Platform = process.platform): string {
  return platform === "darwin" ? "assets/icons/trayTemplate.png" : "assets/icons/tray-color.png";
}

/**
 * Builds the pure Electron Menu template for the CoreBlow Menu Bar / System Tray.
 */
export function buildTrayMenuTemplate(
  state: TrayMenuState,
  handlers: TrayMenuHandlers,
): MenuItemConstructorOptions[] {
  const statusLabel = state.gatewayOnline
    ? "CoreBlow Gateway: Online"
    : "CoreBlow Gateway: Offline";

  return [
    {
      label: statusLabel,
      enabled: false,
    },
    { type: "separator" },
    {
      label: "Open CoreBlow",
      click: () => handlers.onOpenWindow(),
    },
    {
      label: "New Chat",
      click: () => handlers.onNewChat(),
    },
    { type: "separator" },
    {
      label: "Restart Gateway",
      click: () => handlers.onRestartGateway(),
    },
    {
      label: "Check for Updates",
      click: () => handlers.onCheckForUpdates(),
    },
    { type: "separator" },
    {
      label: "Quit CoreBlow",
      click: () => handlers.onQuit(),
    },
  ];
}

function findTrayIconAbsolutePath(platform: NodeJS.Platform): string | null {
  const relPath = resolveTrayIconRelativePath(platform);
  const candidates = [
    path.join(app.getAppPath(), relPath),
    path.resolve(__dirname, "..", relPath),
    path.join(process.cwd(), relPath),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Initializes the native macOS Menu Bar / Windows & Linux System Tray icon.
 */
export function createTrayController(
  initialState: TrayMenuState,
  handlers: TrayMenuHandlers,
): TrayController | null {
  try {
    const iconPath = findTrayIconAbsolutePath(process.platform);
    const image = iconPath ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();

    if (process.platform === "darwin" && !image.isEmpty()) {
      image.setTemplateImage(true);
    }

    const tray = new Tray(image);
    let currentState: TrayMenuState = { ...initialState };

    const applyMenuAndTooltip = () => {
      tray.setToolTip(
        currentState.gatewayOnline
          ? "CoreBlow Studio — Gateway Online"
          : "CoreBlow Studio — Gateway Offline",
      );
      const menu = Menu.buildFromTemplate(buildTrayMenuTemplate(currentState, handlers));
      tray.setContextMenu(menu);
    };

    applyMenuAndTooltip();

    if (process.platform !== "darwin") {
      tray.on("click", () => {
        handlers.onOpenWindow();
      });
    }

    return {
      setGatewayOnline(online: boolean) {
        if (currentState.gatewayOnline === online) {
          return;
        }
        currentState = { gatewayOnline: online };
        applyMenuAndTooltip();
      },
      destroy() {
        try {
          tray.destroy();
        } catch {
          // Ignore teardown errors during quit
        }
      },
    };
  } catch {
    // Gracefully skip tray creation on headless CI/test runners without display server
    return null;
  }
}
