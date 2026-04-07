import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import type { DeviceAuthStore, DeviceAuthEntry } from "../shared/device-auth.js";

const DEVICE_AUTH_FILE = "device-auth.json";

function resolveDeviceAuthPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveStateDir(env), "identity", DEVICE_AUTH_FILE);
}

function readStore(filePath: string): DeviceAuthStore | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.version === 1) {
      return parsed as DeviceAuthStore;
    }
    return null;
  } catch {
    return null;
  }
}

function writeStore(filePath: string, store: DeviceAuthStore): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // best-effort
  }
}

export function loadDeviceAuthToken(params: {
  deviceId: string;
  role: string;
  env?: NodeJS.ProcessEnv;
}): DeviceAuthEntry | null {
  const filePath = resolveDeviceAuthPath(params.env);
  const store = readStore(filePath);
  if (!store || store.deviceId !== params.deviceId) {
    return null;
  }
  const entry = store.tokens?.[params.role];
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const typedEntry = entry as DeviceAuthEntry;
  if (typeof typedEntry.token !== "string" || !typedEntry.token.trim()) {
    return null;
  }
  return typedEntry;
}

export function storeDeviceAuthToken(params: {
  deviceId: string;
  role: string;
  token: string;
  scopes?: string[];
  env?: NodeJS.ProcessEnv;
}): DeviceAuthEntry {
  const filePath = resolveDeviceAuthPath(params.env);
  let store = readStore(filePath);
  if (!store || store.deviceId !== params.deviceId) {
    store = {
      version: 1,
      deviceId: params.deviceId,
      tokens: {},
    };
  }
  const entry: DeviceAuthEntry = {
    token: params.token,
    scopes: params.scopes ?? [],
    storedAt: new Date().toISOString(),
  };
  store.tokens[params.role] = entry;
  writeStore(filePath, store);
  return entry;
}

export function clearDeviceAuthToken(params: {
  deviceId: string;
  role: string;
  env?: NodeJS.ProcessEnv;
}): void {
  const filePath = resolveDeviceAuthPath(params.env);
  const store = readStore(filePath);
  if (!store || store.deviceId !== params.deviceId) {
    return;
  }
  delete store.tokens[params.role];
  writeStore(filePath, store);
}
