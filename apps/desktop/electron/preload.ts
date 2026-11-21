import { contextBridge, ipcRenderer } from "electron";

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
    selectFiles: (options?: { title?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<string[]>;
  };
  clipboard: {
    readText: () => Promise<string>;
    writeText: (text: string) => Promise<boolean>;
  };
  gateway: {
    health: () => Promise<boolean>;
    ensure: () => Promise<boolean>;
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
}

const desktopApi: CoreBlowDesktopApi = {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    coreblow: "2.1.0",
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
    health: () => ipcRenderer.invoke("coreblow:gateway:health"),
    ensure: () => ipcRenderer.invoke("coreblow:gateway:ensure"),
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
};

contextBridge.exposeInMainWorld("coreblowDesktop", desktopApi);
