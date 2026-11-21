import { app, BrowserWindow, ipcMain, dialog, shell, clipboard, safeStorage, desktopCapturer } from "electron";
import * as path from "node:path";
import * as http from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";

let mainWindow: BrowserWindow | null = null;
let gatewayProcess: ChildProcess | null = null;
let isGatewayManagedByDesktop = false;
let isHudMode = false;
let savedBounds: { x: number; y: number; width: number; height: number } | null = null;

function extractSessionIdFromArgv(argv: string[]): string | null {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--session" && argv[i + 1]) {
      return argv[i + 1].trim() || null;
    }
    if (arg && arg.startsWith("--session=")) {
      return arg.slice("--session=".length).trim() || null;
    }
  }
  return null;
}

let currentHandoffSessionId: string | null =
  extractSessionIdFromArgv(process.argv) || process.env.COREBLOW_SESSION_ID?.trim() || null;

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, commandLine) => {
    const handedSessionId = extractSessionIdFromArgv(commandLine);
    if (handedSessionId) {
      currentHandoffSessionId = handedSessionId;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("coreblow:session:handoff", handedSessionId);
      }
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

const GATEWAY_PORT = 18789;
const GATEWAY_HEALTH_URL = `http://127.0.0.1:${GATEWAY_PORT}/health`;

/**
 * Probe whether the CoreBlow Gateway is responding on 127.0.0.1:18789.
 */
function probeGatewayHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(GATEWAY_HEALTH_URL, { timeout: 1500 }, (res: http.IncomingMessage) => {
      resolve(res.statusCode === 200 || res.statusCode === 401);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Locate project root where coreblow.mjs or package.json lives.
 */
function findProjectRoot(): string {
  let curr = app.getAppPath();
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(curr, "coreblow.mjs")) || fs.existsSync(path.join(curr, "pnpm-workspace.yaml"))) {
      return curr;
    }
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return app.getAppPath();
}

/**
 * Ensure the local CoreBlow Gateway daemon is running on 127.0.0.1:18789.
 * If not running, start it as a background process.
 */
async function ensureGatewayDaemon(): Promise<boolean> {
  const isHealthy = await probeGatewayHealth();
  if (isHealthy) {
    return true;
  }

  const projectRoot = findProjectRoot();
  const coreblowMjs = path.join(projectRoot, "coreblow.mjs");

  if (fs.existsSync(coreblowMjs)) {
    try {
      gatewayProcess = spawn(
        process.execPath,
        [coreblowMjs, "gateway", "run", "--port", String(GATEWAY_PORT), "--allow-unconfigured"],
        {
          cwd: projectRoot,
          detached: false,
          stdio: "ignore",
          env: {
            ...process.env,
            PORT: String(GATEWAY_PORT),
          },
        },
      );

      isGatewayManagedByDesktop = true;

      gatewayProcess.on("exit", () => {
        gatewayProcess = null;
        isGatewayManagedByDesktop = false;
      });

      // Poll until listening or timeout with backoff (up to 15 seconds)
      let delayMs = 300;
      const deadline = Date.now() + 15_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, delayMs));
        if (await probeGatewayHealth()) {
          return true;
        }
        delayMs = Math.min(1500, Math.round(delayMs * 1.5));
      }
    } catch {
      // Fall through to return false
    }
  }

  return await probeGatewayHealth();
}

function createWindow(): void {
  const isMac = process.platform === "darwin";

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 520,
    minHeight: 600,
    show: false,
    backgroundColor: "#08110F",
    ...(isMac
      ? {
          titleBarStyle: "hiddenInset",
          trafficLightPosition: {
            x: 16,
            y: 16,
          },
          vibrancy: "sidebar",
          visualEffectState: "active",
        }
      : {
          titleBarStyle: "hidden",
          titleBarOverlay: {
            color: "#08110F",
            symbolColor: "#819B93",
            height: 48,
          },
        }),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      devTools: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http:") || url.startsWith("https:")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  const sendFullscreenState = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("coreblow:window-fullscreen", mainWindow.isFullScreen());
    }
  };

  mainWindow.on("enter-full-screen", sendFullscreenState);
  mainWindow.on("leave-full-screen", sendFullscreenState);
  mainWindow.webContents.on("did-finish-load", sendFullscreenState);

  // Load URL
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    const distPath = path.join(__dirname, "../dist/index.html");
    if (fs.existsSync(distPath)) {
      mainWindow.loadFile(distPath);
    } else {
      mainWindow.loadFile(path.join(app.getAppPath(), "dist/index.html"));
    }
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ─── IPC Handlers ──────────────────────────────────────────────────────────

ipcMain.handle("coreblow:dialog:selectDirectory", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "createDirectory"],
    title: "Select CoreBlow Project Directory",
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle("coreblow:dialog:selectFiles", async (_event, options) => {
  if (!mainWindow) return [];
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile", "multiSelections"],
    title: options?.title || "Attach Files",
    filters: options?.filters,
  });
  if (result.canceled) {
    return [];
  }
  return result.filePaths;
});

ipcMain.handle("coreblow:clipboard:readText", () => {
  return clipboard.readText();
});

ipcMain.handle("coreblow:clipboard:writeText", (_event, text: string) => {
  clipboard.writeText(text);
  return true;
});

ipcMain.handle("coreblow:gateway:health", async () => {
  return await probeGatewayHealth();
});

ipcMain.handle("coreblow:gateway:ensure", async () => {
  return await ensureGatewayDaemon();
});

// ─── Session Handoff ───────────────────────────────────────────────────────

ipcMain.handle("coreblow:session:getInitialSessionId", () => {
  return currentHandoffSessionId;
});

// ─── OS Keychain Encryption (safeStorage) ──────────────────────────────────

ipcMain.handle("coreblow:vault:isAvailable", () => {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
});

ipcMain.handle("coreblow:vault:encrypt", (_event, plain: string) => {
  try {
    if (!plain || typeof plain !== "string") return "";
    if (!safeStorage.isEncryptionAvailable()) {
      return plain;
    }
    const buffer = safeStorage.encryptString(plain);
    return buffer.toString("base64");
  } catch {
    return plain;
  }
});

ipcMain.handle("coreblow:vault:decrypt", (_event, cipherB64: string) => {
  try {
    if (!cipherB64 || typeof cipherB64 !== "string") return "";
    if (!safeStorage.isEncryptionAvailable()) {
      return cipherB64;
    }
    const buffer = Buffer.from(cipherB64, "base64");
    return safeStorage.decryptString(buffer);
  } catch {
    return cipherB64;
  }
});

ipcMain.handle("coreblow:window:minimize", () => {
  mainWindow?.minimize();
});

ipcMain.handle("coreblow:window:maximize", () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle("coreblow:window:close", () => {
  mainWindow?.close();
});

ipcMain.handle("coreblow:window:isMaximized", () => {
  return mainWindow?.isMaximized() ?? false;
});

ipcMain.handle("coreblow:window:toggleHud", () => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  if (!isHudMode) {
    if (mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
    }
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    }
    savedBounds = mainWindow.getBounds();
    mainWindow.setAlwaysOnTop(true, "floating");
    mainWindow.setMinimumSize(320, 480);
    mainWindow.setSize(460, 640);
    mainWindow.center();
    isHudMode = true;
  } else {
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setMinimumSize(520, 600);
    if (savedBounds) {
      mainWindow.setBounds(savedBounds);
    } else {
      mainWindow.setSize(1280, 820);
      mainWindow.center();
    }
    isHudMode = false;
  }
  return isHudMode;
});

ipcMain.handle("coreblow:screen:captureActive", async () => {
  const sources = await desktopCapturer.getSources({
    types: ["screen", "window"],
    thumbnailSize: { width: 1280, height: 800 },
  });
  if (!sources || sources.length === 0) {
    throw new Error("No screen capture source available");
  }
  const primarySource = sources[0];
  const pngBuffer = primarySource.thumbnail.toPNG();
  const capturePath = path.join(os.tmpdir(), `coreblow-capture-${Date.now()}.png`);
  await fs.promises.writeFile(capturePath, pngBuffer);
  return capturePath;
});

// ─── App Lifecycle ─────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  await ensureGatewayDaemon();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  if (isGatewayManagedByDesktop && gatewayProcess) {
    try {
      gatewayProcess.kill();
    } catch {
      // Ignore cleanup error
    }
  }
});
