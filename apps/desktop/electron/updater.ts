import { app, ipcMain, type BrowserWindow } from "electron";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";

export type UpdatePhase =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export interface UpdateStatus {
  phase: UpdatePhase;
  currentVersion: string;
  availableVersion?: string;
  releaseNotes?: string;
  progressPercent?: number;
  error?: string;
  autoCheckEnabled: boolean;
  lastCheckedAt?: number;
  supported: boolean;
}

export interface AutoUpdaterLike {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  on: (event: string, listener: (...args: unknown[]) => void) => unknown;
  checkForUpdates: () => Promise<unknown>;
  downloadUpdate: () => Promise<unknown>;
  quitAndInstall: (isSilent?: boolean, isForceRunAfter?: boolean) => void;
}

export interface UpdaterPrefsStore {
  loadAutoCheck: () => boolean;
  saveAutoCheck: (enabled: boolean) => void;
}

export interface UpdaterControllerDeps {
  currentVersion: string;
  isPackaged: boolean;
  autoUpdater?: AutoUpdaterLike | null;
  prefsStore?: UpdaterPrefsStore;
  onStatusChange?: (status: UpdateStatus) => void;
  now?: () => number;
}

export interface UpdaterController {
  getStatus: () => UpdateStatus;
  checkForUpdates: (options?: { manual?: boolean }) => Promise<UpdateStatus>;
  downloadUpdate: () => Promise<UpdateStatus>;
  quitAndInstall: () => boolean;
  setAutoCheck: (enabled: boolean) => UpdateStatus;
  dispose: () => void;
}

function createDiskPrefsStore(): UpdaterPrefsStore {
  const getFilePath = () => path.join(app.getPath("userData"), "updater-prefs.json");
  return {
    loadAutoCheck() {
      try {
        const filePath = getFilePath();
        if (!fs.existsSync(filePath)) return true;
        const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
          autoCheckEnabled?: unknown;
        };
        return typeof parsed.autoCheckEnabled === "boolean" ? parsed.autoCheckEnabled : true;
      } catch {
        return true;
      }
    },
    saveAutoCheck(enabled: boolean) {
      try {
        const filePath = getFilePath();
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify({ autoCheckEnabled: enabled }, null, 2));
      } catch {
        // Ignore read-only userData failures
      }
    },
  };
}

function normalizeReleaseNotes(notes: unknown): string | undefined {
  if (typeof notes === "string") {
    return notes.trim() || undefined;
  }
  if (Array.isArray(notes)) {
    const joined = notes
      .map((entry) => {
        if (entry && typeof entry === "object" && "note" in entry) {
          return String((entry as { note?: unknown }).note ?? "");
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
    return joined.trim() || undefined;
  }
  return undefined;
}

/**
 * Formats a concise one-line status string for Settings and dialogs.
 */
export function formatUpdateStatusLabel(status: UpdateStatus): string {
  switch (status.phase) {
    case "checking":
      return "Checking for updates...";
    case "available":
      return status.availableVersion
        ? `Update v${status.availableVersion} available`
        : "Update available";
    case "downloading":
      return typeof status.progressPercent === "number"
        ? `Downloading update (${Math.round(status.progressPercent)}%)`
        : "Downloading update...";
    case "downloaded":
      return status.availableVersion
        ? `Ready to restart (v${status.availableVersion})`
        : "Ready to restart";
    case "not-available":
      return "Up to date";
    case "error":
      return status.error ? `Offline or unavailable (${status.error})` : "Update check failed";
    case "idle":
    default:
      return status.supported ? "Up to date" : "Up to date (local build)";
  }
}

export function createUpdaterController(deps: UpdaterControllerDeps): UpdaterController {
  const now = deps.now ?? (() => Date.now());
  const prefsStore = deps.prefsStore ?? createDiskPrefsStore();
  const autoUpdater = deps.autoUpdater ?? null;
  const supported = deps.isPackaged && Boolean(autoUpdater);

  let status: UpdateStatus = {
    phase: "idle",
    currentVersion: deps.currentVersion,
    autoCheckEnabled: prefsStore.loadAutoCheck(),
    supported,
  };

  let activeManualCheck = false;
  let initialTimer: ReturnType<typeof setTimeout> | null = null;
  let intervalTimer: ReturnType<typeof setInterval> | null = null;

  const setStatus = (patch: Partial<UpdateStatus>) => {
    status = { ...status, ...patch };
    deps.onStatusChange?.({ ...status });
  };

  if (autoUpdater) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on("checking-for-update", () => {
      setStatus({ phase: "checking", error: undefined });
    });

    autoUpdater.on("update-available", (rawInfo: unknown) => {
      const info = (rawInfo ?? {}) as { version?: unknown; releaseNotes?: unknown };
      const availableVersion =
        typeof info.version === "string" ? info.version : status.availableVersion;
      setStatus({
        phase: "available",
        availableVersion,
        releaseNotes: normalizeReleaseNotes(info.releaseNotes),
        error: undefined,
        lastCheckedAt: now(),
      });
    });

    autoUpdater.on("update-not-available", () => {
      setStatus({
        phase: "not-available",
        error: undefined,
        progressPercent: undefined,
        lastCheckedAt: now(),
      });
    });

    autoUpdater.on("download-progress", (rawProgress: unknown) => {
      const progress = (rawProgress ?? {}) as { percent?: unknown };
      const pct = typeof progress.percent === "number" ? progress.percent : 0;
      setStatus({
        phase: "downloading",
        progressPercent: Math.max(0, Math.min(100, Math.round(pct))),
      });
    });

    autoUpdater.on("update-downloaded", (rawInfo: unknown) => {
      const info = (rawInfo ?? {}) as { version?: unknown; releaseNotes?: unknown };
      const availableVersion =
        typeof info.version === "string" ? info.version : status.availableVersion;
      setStatus({
        phase: "downloaded",
        availableVersion,
        releaseNotes: normalizeReleaseNotes(info.releaseNotes) ?? status.releaseNotes,
        progressPercent: 100,
        error: undefined,
      });
    });

    autoUpdater.on("error", (rawErr: unknown) => {
      const message =
        rawErr instanceof Error
          ? rawErr.message
          : typeof rawErr === "string"
            ? rawErr
            : "Update service unreachable";
      if (!activeManualCheck && !deps.isPackaged) {
        return;
      }
      setStatus({
        phase: activeManualCheck ? "error" : "idle",
        error: activeManualCheck ? message : undefined,
        lastCheckedAt: now(),
      });
    });
  }

  const checkForUpdates = async (options?: { manual?: boolean }): Promise<UpdateStatus> => {
    const manual = options?.manual ?? false;
    activeManualCheck = manual;

    if (!supported || !autoUpdater) {
      setStatus({
        phase: "not-available",
        error: undefined,
        lastCheckedAt: now(),
      });
      activeManualCheck = false;
      return { ...status };
    }

    setStatus({ phase: "checking", error: undefined });
    try {
      await autoUpdater.checkForUpdates();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus({
        phase: manual ? "error" : "idle",
        error: manual ? message : undefined,
        lastCheckedAt: now(),
      });
    } finally {
      activeManualCheck = false;
    }

    return { ...status };
  };

  const downloadUpdate = async (): Promise<UpdateStatus> => {
    if (!supported || !autoUpdater) {
      return { ...status };
    }
    setStatus({ phase: "downloading", progressPercent: 0, error: undefined });
    try {
      await autoUpdater.downloadUpdate();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus({ phase: "error", error: message });
    }
    return { ...status };
  };

  const quitAndInstall = (): boolean => {
    if (!supported || !autoUpdater || status.phase !== "downloaded") {
      return false;
    }
    try {
      autoUpdater.quitAndInstall(false, true);
      return true;
    } catch {
      return false;
    }
  };

  const setAutoCheck = (enabled: boolean): UpdateStatus => {
    prefsStore.saveAutoCheck(enabled);
    setStatus({ autoCheckEnabled: enabled });
    return { ...status };
  };

  if (supported && status.autoCheckEnabled) {
    initialTimer = setTimeout(() => {
      void checkForUpdates({ manual: false });
    }, 6_000);
    intervalTimer = setInterval(() => {
      if (status.autoCheckEnabled) {
        void checkForUpdates({ manual: false });
      }
    }, 6 * 60 * 60 * 1000);
  }

  return {
    getStatus: () => ({ ...status }),
    checkForUpdates,
    downloadUpdate,
    quitAndInstall,
    setAutoCheck,
    dispose() {
      if (initialTimer) clearTimeout(initialTimer);
      if (intervalTimer) clearInterval(intervalTimer);
      initialTimer = null;
      intervalTimer = null;
    },
  };
}

function loadElectronAutoUpdater(): AutoUpdaterLike | null {
  try {
    const req = createRequire(path.join(app.getAppPath(), "package.json"));
    const mod = req("electron-updater") as { autoUpdater?: AutoUpdaterLike };
    return mod?.autoUpdater ?? null;
  } catch {
    return null;
  }
}

export function initUpdater(options: {
  getMainWindow: () => BrowserWindow | null;
  beforeQuitInstall: () => void;
}): UpdaterController {
  const autoUpdater = app.isPackaged ? loadElectronAutoUpdater() : null;

  const controller = createUpdaterController({
    currentVersion: app.getVersion(),
    isPackaged: app.isPackaged,
    autoUpdater,
    onStatusChange: (nextStatus) => {
      const win = options.getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send("coreblow:updater:status", nextStatus);
      }
    },
  });

  ipcMain.handle("coreblow:updater:getStatus", () => controller.getStatus());
  ipcMain.handle("coreblow:updater:check", () => controller.checkForUpdates({ manual: true }));
  ipcMain.handle("coreblow:updater:download", () => controller.downloadUpdate());
  ipcMain.handle("coreblow:updater:install", () => {
    options.beforeQuitInstall();
    return controller.quitAndInstall();
  });
  ipcMain.handle("coreblow:updater:setAutoCheck", (_event, enabled: boolean) =>
    controller.setAutoCheck(Boolean(enabled)),
  );

  return controller;
}
