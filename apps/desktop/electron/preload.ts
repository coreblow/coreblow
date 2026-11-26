import { contextBridge, ipcRenderer } from "electron";
import type { UpdateStatus } from "./updater";

export type { UpdateStatus };

export interface CoreBlowDesktopApi {
  platform: string;
  versions: {
    node: string;
    chrome: string;
    electron: string;
    coreblow: string;
  };
  dialog: {
    selectDirectory: () => Promise<string | null>;
    selectFiles: (options?: {
      title?: string;
      filters?: { name: string; extensions: string[] }[];
    }) => Promise<string[]>;
  };
  clipboard: {
    readText: () => Promise<string>;
    writeText: (text: string) => Promise<boolean>;
  };
  gateway: {
    url?: string;
    health: () => Promise<boolean>;
    ensure: () => Promise<boolean>;
    getUrl?: () => Promise<string>;
  };
  vault: {
    isAvailable: () => Promise<boolean>;
    encrypt: (plain: string) => Promise<string>;
    decrypt: (cipherB64: string) => Promise<string>;
  };
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
    toggleHud: () => Promise<boolean>;
    onFullscreenChange: (callback: (fullscreen: boolean) => void) => () => void;
  };
  session: {
    getInitialSessionId: () => Promise<string | null>;
    onHandoff: (callback: (sessionId: string) => void) => () => void;
  };
  screen: {
    captureActive: () => Promise<string>;
  };
  terminal: {
    exec: (
      command: string,
      cwd?: string,
    ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
    openExternal: (cwd?: string) => Promise<boolean>;
    getInfo: (cwd?: string) => Promise<{
      shell: string;
      cwd: string;
      username: string;
      hostname: string;
      platform: string;
    }>;
  };
  diagnostics: {
    openLogs: () => Promise<{ ok: boolean; path?: string; error?: string }>;
  };
  tray: {
    onNewChat: (callback: () => void) => () => void;
  };
  updater: {
    getStatus: () => Promise<UpdateStatus>;
    checkForUpdates: () => Promise<UpdateStatus>;
    downloadUpdate: () => Promise<UpdateStatus>;
    quitAndInstall: () => Promise<boolean>;
    setAutoCheck: (enabled: boolean) => Promise<UpdateStatus>;
    onStatusChange: (callback: (status: UpdateStatus) => void) => () => void;
  };
}

function resolveInitialGatewayUrl(): string {
  const raw = process.env.COREBLOW_GATEWAY_URL?.trim();
  if (raw) {
    try {
      const parsed = new URL(raw);
      if (parsed.protocol === "ws:") parsed.protocol = "http:";
      if (parsed.protocol === "wss:") parsed.protocol = "https:";
      return `${parsed.protocol}//${parsed.host}`;
    } catch {}
  }
  const envPort = Number.parseInt(process.env.COREBLOW_GATEWAY_PORT ?? "", 10);
  const port = Number.isFinite(envPort) && envPort > 0 ? envPort : 18789;
  return `http://127.0.0.1:${port}`;
}

const desktopApi: CoreBlowDesktopApi = {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    coreblow: "2.4.0",
  },
  dialog: {
    selectDirectory: () => ipcRenderer.invoke("coreblow:dialog:selectDirectory"),
    selectFiles: (options) => ipcRenderer.invoke("coreblow:dialog:selectFiles", options),
  },
  clipboard: {
    readText: () => ipcRenderer.invoke("coreblow:clipboard:readText"),
    writeText: (text) => ipcRenderer.invoke("coreblow:clipboard:writeText", text),
  },
  gateway: {
    url: resolveInitialGatewayUrl(),
    health: () => ipcRenderer.invoke("coreblow:gateway:health"),
    ensure: () => ipcRenderer.invoke("coreblow:gateway:ensure"),
    getUrl: () => ipcRenderer.invoke("coreblow:gateway:getUrl"),
  },
  vault: {
    isAvailable: () => ipcRenderer.invoke("coreblow:vault:isAvailable"),
    encrypt: (plain: string) => ipcRenderer.invoke("coreblow:vault:encrypt", plain),
    decrypt: (cipherB64: string) => ipcRenderer.invoke("coreblow:vault:decrypt", cipherB64),
  },
  window: {
    minimize: () => ipcRenderer.invoke("coreblow:window:minimize"),
    maximize: () => ipcRenderer.invoke("coreblow:window:maximize"),
    close: () => ipcRenderer.invoke("coreblow:window:close"),
    isMaximized: () => ipcRenderer.invoke("coreblow:window:isMaximized"),
    toggleHud: () => ipcRenderer.invoke("coreblow:window:toggleHud"),
    onFullscreenChange: (callback: (fullscreen: boolean) => void) => {
      const handler = (_event: unknown, isFullscreen: boolean) => callback(isFullscreen);
      ipcRenderer.on("coreblow:window-fullscreen", handler);
      return () => {
        ipcRenderer.removeListener("coreblow:window-fullscreen", handler);
      };
    },
  },
  session: {
    getInitialSessionId: () => ipcRenderer.invoke("coreblow:session:getInitialSessionId"),
    onHandoff: (callback: (sessionId: string) => void) => {
      const handler = (_event: unknown, sessionId: string) => callback(sessionId);
      ipcRenderer.on("coreblow:session:handoff", handler);
      return () => {
        ipcRenderer.removeListener("coreblow:session:handoff", handler);
      };
    },
  },
  screen: {
    captureActive: () => ipcRenderer.invoke("coreblow:screen:captureActive"),
  },
  terminal: {
    exec: (command: string, cwd?: string) =>
      ipcRenderer.invoke("coreblow:terminal:exec", { command, cwd }),
    openExternal: (cwd?: string) => ipcRenderer.invoke("coreblow:terminal:openExternal", { cwd }),
    getInfo: (cwd?: string) => ipcRenderer.invoke("coreblow:terminal:getInfo", { cwd }),
  },
  diagnostics: {
    openLogs: () => ipcRenderer.invoke("coreblow:diagnostics:openLogs"),
  },
  tray: {
    onNewChat: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on("coreblow:tray:new-chat", handler);
      return () => {
        ipcRenderer.removeListener("coreblow:tray:new-chat", handler);
      };
    },
  },
  updater: {
    getStatus: () => ipcRenderer.invoke("coreblow:updater:getStatus"),
    checkForUpdates: () => ipcRenderer.invoke("coreblow:updater:check"),
    downloadUpdate: () => ipcRenderer.invoke("coreblow:updater:download"),
    quitAndInstall: () => ipcRenderer.invoke("coreblow:updater:install"),
    setAutoCheck: (enabled: boolean) =>
      ipcRenderer.invoke("coreblow:updater:setAutoCheck", enabled),
    onStatusChange: (callback: (status: UpdateStatus) => void) => {
      const handler = (_event: unknown, status: UpdateStatus) => callback(status);
      ipcRenderer.on("coreblow:updater:status", handler);
      return () => {
        ipcRenderer.removeListener("coreblow:updater:status", handler);
      };
    },
  },
};

contextBridge.exposeInMainWorld("coreblowDesktop", desktopApi);
