import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resolveStateDir } from "../config/paths.js";

export type PairingPlatform = "telegram" | "whatsapp" | "discord" | "slack" | string;

export interface PendingPairingRequest {
  id: string;
  code: string; // e.g. "COREBLOW-7K9A"
  platform: PairingPlatform;
  externalUserId: string;
  displayName?: string;
  requestedAtMs: number;
  expiresAtMs: number;
}

export interface ApprovedPairing {
  id: string;
  code?: string;
  platform: PairingPlatform;
  externalUserId: string;
  displayName?: string;
  approvedAtMs: number;
}

export interface PairingStoreData {
  version: 1;
  pending: PendingPairingRequest[];
  approved: ApprovedPairing[];
}

export type PairingCheckResult =
  | { authorized: true }
  | { authorized: false; code: string; message: string };

const CODE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // pragma: allowlist secret

function generatePairingCode(): string {
  let chars = "";
  for (let i = 0; i < 4; i++) {
    const idx = Math.floor(Math.random() * CODE_CHARS.length);
    chars += CODE_CHARS[idx];
  }
  return `COREBLOW-${chars}`;
}

/**
 * Resolves the path to the pairing store JSON file.
 * Defaults to ~/.coreblow/pairing/pairing.json.
 */
export function resolvePairingStorePath(customPath?: string): string {
  if (customPath && customPath.trim().length > 0) {
    const raw = customPath.trim();
    if (raw.startsWith("~")) {
      const home = process.env.HOME ?? os.homedir();
      return path.resolve(home, raw.slice(1).replace(/^\/+/, ""));
    }
    return path.resolve(raw);
  }

  const envPath = process.env.COREBLOW_PAIRING_STORE_PATH?.trim();
  if (envPath) {
    if (envPath.startsWith("~")) {
      const home = process.env.HOME ?? os.homedir();
      return path.resolve(home, envPath.slice(1).replace(/^\/+/, ""));
    }
    return path.resolve(envPath);
  }

  const stateDir = resolveStateDir();
  return path.join(stateDir, "pairing", "pairing.json");
}

/**
 * Loads pairing store data synchronously.
 */
export function loadPairingStoreSync(storePath?: string): PairingStoreData {
  const filePath = resolvePairingStorePath(storePath);
  if (!fs.existsSync(filePath)) {
    return { version: 1, pending: [], approved: [] };
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<PairingStoreData>;
    if (parsed && typeof parsed === "object") {
      return {
        version: 1,
        pending: Array.isArray(parsed.pending) ? parsed.pending : [],
        approved: Array.isArray(parsed.approved) ? parsed.approved : [],
      };
    }
  } catch {
    // Return empty store on corrupt file
  }

  return { version: 1, pending: [], approved: [] };
}

/**
 * Atomically saves pairing store data to disk.
 */
export function savePairingStoreSync(data: PairingStoreData, storePath?: string): void {
  const filePath = resolvePairingStorePath(storePath);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const json = JSON.stringify(data, null, 2);
  const tmpFile = `${filePath}.tmp.${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  try {
    fs.writeFileSync(tmpFile, json, "utf-8");
    fs.renameSync(tmpFile, filePath);
  } catch {
    fs.writeFileSync(filePath, json, "utf-8");
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch {}
  }
}

/**
 * Checks if a user is paired/authorized, or registers a new pending pairing code.
 */
export function requestOrCheckPairing(
  params: {
    platform: PairingPlatform;
    externalUserId: string;
    displayName?: string;
  },
  storePath?: string,
): PairingCheckResult {
  const store = loadPairingStoreSync(storePath);
  const platform = params.platform.toLowerCase();
  const externalUserId = params.externalUserId.trim();
  const now = Date.now();

  // 1. Check if user is already approved
  const isApproved = store.approved.some(
    (a) => a.platform.toLowerCase() === platform && a.externalUserId === externalUserId,
  );
  if (isApproved) {
    return { authorized: true };
  }

  // 2. Check for active unexpired pending request
  const existingPending = store.pending.find(
    (p) =>
      p.platform.toLowerCase() === platform &&
      p.externalUserId === externalUserId &&
      p.expiresAtMs > now,
  );

  if (existingPending) {
    return {
      authorized: false,
      code: existingPending.code,
      message: `Access protected. Your CoreBlow pairing code is ${existingPending.code}. Approve it in CoreBlow Desktop -> Pairing.`,
    };
  }

  // 3. Generate a new pending code
  // Clean up any old expired pending requests for this user
  store.pending = store.pending.filter(
    (p) =>
      !(p.platform.toLowerCase() === platform && p.externalUserId === externalUserId) &&
      p.expiresAtMs > now,
  );

  let code = generatePairingCode();
  let attempts = 0;
  while (store.pending.some((p) => p.code === code) && attempts < 100) {
    code = generatePairingCode();
    attempts++;
  }
  const newRequest: PendingPairingRequest = {
    id: `req_${now}_${Math.random().toString(36).slice(2, 6)}`,
    code,
    platform: params.platform,
    externalUserId,
    displayName: params.displayName,
    requestedAtMs: now,
    expiresAtMs: now + 24 * 60 * 60 * 1000, // Valid 24 hours
  };

  store.pending.push(newRequest);
  savePairingStoreSync(store, storePath);

  return {
    authorized: false,
    code,
    message: `Access protected. Your CoreBlow pairing code is ${code}. Approve it in CoreBlow Desktop -> Pairing.`,
  };
}

/**
 * Lists the current pairing state (pending requests and approved users).
 */
export function listPairingState(storePath?: string): {
  pending: PendingPairingRequest[];
  approved: ApprovedPairing[];
} {
  const store = loadPairingStoreSync(storePath);
  const now = Date.now();
  // Filter out expired pending requests
  const activePending = store.pending.filter((p) => p.expiresAtMs > now);
  return {
    pending: activePending,
    approved: store.approved,
  };
}

/**
 * Approves a pending pairing request by its code (e.g. "COREBLOW-A7K2") or request ID.
 */
export function approvePairing(codeOrId: string, storePath?: string): boolean {
  const store = loadPairingStoreSync(storePath);
  const target = codeOrId.trim().toUpperCase();

  const matchIdx = store.pending.findIndex(
    (p) => p.code.toUpperCase() === target || p.id.toUpperCase() === target,
  );

  if (matchIdx === -1) {
    return false;
  }

  const req = store.pending[matchIdx];
  store.pending.splice(matchIdx, 1);

  // Avoid duplicate approved records
  const alreadyApproved = store.approved.some(
    (a) =>
      a.platform.toLowerCase() === req.platform.toLowerCase() &&
      a.externalUserId === req.externalUserId,
  );

  if (!alreadyApproved) {
    store.approved.push({
      id: req.id,
      code: req.code,
      platform: req.platform,
      externalUserId: req.externalUserId,
      displayName: req.displayName,
      approvedAtMs: Date.now(),
    });
  }

  savePairingStoreSync(store, storePath);
  return true;
}

/**
 * Revokes approval for a paired user by their externalUserId, code, or approved ID.
 */
export function revokePairing(externalUserIdOrId: string, storePath?: string): boolean {
  const store = loadPairingStoreSync(storePath);
  const target = externalUserIdOrId.trim();

  const initialCount = store.approved.length;
  store.approved = store.approved.filter(
    (a) =>
      a.externalUserId !== target &&
      a.id !== target &&
      a.code?.toUpperCase() !== target.toUpperCase(),
  );

  if (store.approved.length < initialCount) {
    savePairingStoreSync(store, storePath);
    return true;
  }

  return false;
}
