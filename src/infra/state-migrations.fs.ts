import fs from "node:fs";
import JSON5 from "json5";

export type SessionEntryLike = {
  sessionId?: string;
  updatedAt?: number;
} & Record<string, unknown>;

export function safeReadDir(dir: string): fs.Dirent[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

export function existsDir(dir: string): boolean {
  try {
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

export function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export function fileExists(p: string): boolean {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

export function isLegacyWhatsAppAuthFile(name: string): boolean {
  if (name === "creds.json" || name === "creds.json.bak") {
    return true;
  }
  if (!name.endsWith(".json")) {
    return false;
  }
  return /^(app-state-sync|session|sender-key|pre-key)-/.test(name);
}

export function readSessionStoreJson5(storePath: string): {
  store: Record<string, SessionEntryLike>;
  ok: boolean;
} {
  try {
    const raw = fs.readFileSync(storePath, "utf-8");
    const parsed = JSON5.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { store: parsed as Record<string, SessionEntryLike>, ok: true };
    }
  } catch {
    // ignore
  }
  return { store: {}, ok: false };
}

// ---------------------------------------------------------------------------
// StateMigrationFsService — Tier-1 Standalone Singleton
// ---------------------------------------------------------------------------

import { createStandaloneSingleton } from "./service-patterns.js";
export class StateMigrationFsService {
  safeReadDir(dir: string) {
    return safeReadDir(dir);
  }

  existsDir(dir: string) {
    return existsDir(dir);
  }

  ensureDir(dir: string) {
    return ensureDir(dir);
  }

  fileExists(p: string) {
    return fileExists(p);
  }

  isLegacyWhatsAppAuthFile(name: string) {
    return isLegacyWhatsAppAuthFile(name);
  }

  readSessionStoreJson5(storePath: string) {
    return readSessionStoreJson5(storePath);
  }
}


const { getInstance: getStateMigrationFsService, __testing: __testing_stateMigrationFs } =
  createStandaloneSingleton({ create: () => new StateMigrationFsService(), defaultDeps: {} });

export { getStateMigrationFsService, __testing_stateMigrationFs };
