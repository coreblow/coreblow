import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import { registerDynamicRedactionSecrets } from "./secret-redactor.js";

export type VaultEntryKind = "login" | "payment" | "address";

export type VaultEntryPayload = {
  /** Login password (never returned to LLM). */
  password?: string;
  /** Base32 secret or otpauth://totp/... URI (never returned to LLM). */
  totpSecret?: string;
  /** Optional payment fields. */
  cardNumber?: string;
  cardholderName?: string;
  expMonth?: string;
  expYear?: string;
  cvc?: string;
  billingPostalCode?: string;
  /** Optional address fields. */
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

export type VaultEntryMetadata = {
  id: string;
  kind: VaultEntryKind;
  label: string;
  /** Non-secret login username/email/phone. */
  identifier?: string;
  /** Strict origin allowlist (`https://example.com`). Wildcards rejected. */
  allowedOrigins: string[];
  hasTotp: boolean;
  createdAt: string;
  updatedAt: string;
};

type StoredVaultEntry = VaultEntryMetadata & {
  encryptedPayload: string;
};

type VaultFileEnvelope = {
  version: 1;
  entries: StoredVaultEntry[];
};

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function normalizeVaultOrigin(rawOrigin: string): string {
  const trimmed = rawOrigin.trim();
  if (!trimmed || trimmed.includes("*")) {
    throw new Error(`Invalid vault origin "${rawOrigin}": exact scheme://host[:port] required (no wildcards).`);
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid vault origin "${rawOrigin}".`);
  }
  if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || parsed.origin === "null") {
    throw new Error(`Unsupported vault origin protocol "${parsed.protocol}".`);
  }
  return parsed.origin;
}

function resolveVaultDir(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveStateDir(env), "security");
}

export function resolveVaultFilePath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveVaultDir(env), "vault.enc");
}

function resolveVaultKeyPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveVaultDir(env), "vault.key");
}

function ensurePrivateDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(dirPath, 0o700);
  } catch {
    // Best-effort on non-POSIX filesystems
  }
}

function loadOrCreateMasterKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const envKey = env.COREBLOW_VAULT_MASTER_KEY?.trim();
  if (envKey) {
    return crypto.createHash("sha256").update(envKey, "utf8").digest();
  }
  const keyPath = resolveVaultKeyPath(env);
  ensurePrivateDir(path.dirname(keyPath));
  if (fs.existsSync(keyPath)) {
    const raw = fs.readFileSync(keyPath, "utf8").trim();
    const buf = Buffer.from(raw, "hex");
    if (buf.length === 32) {
      return buf;
    }
  }
  const generated = crypto.randomBytes(32);
  fs.writeFileSync(keyPath, `${generated.toString("hex")}\n`, { encoding: "utf8", mode: 0o600 });
  try {
    fs.chmodSync(keyPath, 0o600);
  } catch {
    // Best-effort
  }
  return generated;
}

function encryptPayload(payload: VaultEntryPayload, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    v: 1,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  });
}

function decryptPayload(encoded: string, key: Buffer): VaultEntryPayload {
  const parsed = JSON.parse(encoded) as { iv: string; tag: string; data: string };
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(parsed.iv, "base64"));
  decipher.setAuthTag(Buffer.from(parsed.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(parsed.data, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8")) as VaultEntryPayload;
}

function readVaultEnvelope(env: NodeJS.ProcessEnv = process.env): VaultFileEnvelope {
  const vaultPath = resolveVaultFilePath(env);
  if (!fs.existsSync(vaultPath)) {
    return { version: 1, entries: [] };
  }
  const raw = fs.readFileSync(vaultPath, "utf8");
  const parsed = JSON.parse(raw) as Partial<VaultFileEnvelope>;
  return {
    version: 1,
    entries: Array.isArray(parsed.entries) ? parsed.entries : [],
  };
}

function writeVaultEnvelope(envelope: VaultFileEnvelope, env: NodeJS.ProcessEnv = process.env): void {
  const vaultPath = resolveVaultFilePath(env);
  ensurePrivateDir(path.dirname(vaultPath));
  const tmpPath = `${vaultPath}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(envelope, null, 2), { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmpPath, vaultPath);
  try {
    fs.chmodSync(vaultPath, 0o600);
  } catch {
    // Best-effort
  }
}

function decodeBase32(rawSecret: string): Buffer {
  const cleaned = rawSecret.toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) {
      throw new Error("Invalid base32 character in TOTP secret.");
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/**
 * Deterministic RFC 6238 TOTP generator supporting raw base32 secrets and `otpauth://totp/...` URIs.
 */
export function generateTotpCode(secretOrUri: string, nowMs = Date.now()): string {
  let secret = secretOrUri.trim();
  let algorithm: "sha1" | "sha256" | "sha512" = "sha1";
  let digits = 6;
  let period = 30;

  if (secret.toLowerCase().startsWith("otpauth://")) {
    const uri = new URL(secret);
    secret = uri.searchParams.get("secret") ?? "";
    const algo = (uri.searchParams.get("algorithm") ?? "SHA1").toUpperCase();
    if (algo === "SHA256") {
      algorithm = "sha256";
    } else if (algo === "SHA512") {
      algorithm = "sha512";
    }
    const parsedDigits = Number(uri.searchParams.get("digits") ?? "6");
    if (parsedDigits === 6 || parsedDigits === 8) {
      digits = parsedDigits;
    }
    const parsedPeriod = Number(uri.searchParams.get("period") ?? "30");
    if (Number.isFinite(parsedPeriod) && parsedPeriod > 0) {
      period = Math.floor(parsedPeriod);
    }
  }
  if (!secret) {
    throw new Error("Empty TOTP secret.");
  }

  const key = decodeBase32(secret);
  const counter = Math.floor(nowMs / 1000 / period);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac(algorithm, key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  const code = binary % 10 ** digits;
  return String(code).padStart(digits, "0");
}

function toPublicMetadata(entry: StoredVaultEntry): VaultEntryMetadata {
  return {
    id: entry.id,
    kind: entry.kind,
    label: entry.label,
    ...(entry.identifier ? { identifier: entry.identifier } : {}),
    allowedOrigins: entry.allowedOrigins,
    hasTotp: entry.hasTotp,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export function addVaultEntry(params: {
  id?: string;
  kind: VaultEntryKind;
  label: string;
  identifier?: string;
  allowedOrigins: string[];
  payload: VaultEntryPayload;
  env?: NodeJS.ProcessEnv;
}): VaultEntryMetadata {
  const env = params.env ?? process.env;
  const allowedOrigins = Array.from(new Set(params.allowedOrigins.map(normalizeVaultOrigin)));
  if (allowedOrigins.length === 0) {
    throw new Error("At least one exact allowedOrigin is required for a Credential Vault entry.");
  }
  const key = loadOrCreateMasterKey(env);
  const envelope = readVaultEnvelope(env);
  const id =
    params.id?.trim() ||
    `${params.kind}-${crypto.randomBytes(4).toString("hex")}`;
  const now = new Date().toISOString();
  const existingIdx = envelope.entries.findIndex((e) => e.id === id);
  const createdAt = existingIdx >= 0 ? envelope.entries[existingIdx]!.createdAt : now;
  const stored: StoredVaultEntry = {
    id,
    kind: params.kind,
    label: params.label.trim() || id,
    ...(params.identifier?.trim() ? { identifier: params.identifier.trim() } : {}),
    allowedOrigins,
    hasTotp: Boolean(params.payload.totpSecret?.trim()),
    createdAt,
    updatedAt: now,
    encryptedPayload: encryptPayload(params.payload, key),
  };
  if (existingIdx >= 0) {
    envelope.entries[existingIdx] = stored;
  } else {
    envelope.entries.push(stored);
  }
  writeVaultEnvelope(envelope, env);
  return toPublicMetadata(stored);
}

export function listVaultEntries(env: NodeJS.ProcessEnv = process.env): VaultEntryMetadata[] {
  return readVaultEnvelope(env).entries.map(toPublicMetadata);
}

export function removeVaultEntry(id: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const envelope = readVaultEnvelope(env);
  const nextEntries = envelope.entries.filter((entry) => entry.id !== id);
  if (nextEntries.length === envelope.entries.length) {
    return false;
  }
  writeVaultEnvelope({ version: 1, entries: nextEntries }, env);
  return true;
}

export function resolveVaultSecretForOrigin(params: {
  entryId: string;
  currentOrigin: string;
  env?: NodeJS.ProcessEnv;
}): {
  entry: VaultEntryMetadata;
  origin: string;
  payload: VaultEntryPayload;
} {
  const env = params.env ?? process.env;
  const origin = normalizeVaultOrigin(params.currentOrigin);
  const envelope = readVaultEnvelope(env);
  const stored = envelope.entries.find((e) => e.id === params.entryId);
  if (!stored) {
    throw new Error(`Credential Vault entry "${params.entryId}" not found.`);
  }
  if (!stored.allowedOrigins.includes(origin)) {
    throw new Error(
      `Credential Vault origin mismatch (fail-closed): "${origin}" is not in allowedOrigins for "${params.entryId}".`,
    );
  }
  const key = loadOrCreateMasterKey(env);
  const payload = decryptPayload(stored.encryptedPayload, key);
  const secretsToRedact = Object.values(payload).filter(
    (val): val is string => typeof val === "string" && val.length >= 4,
  );
  registerDynamicRedactionSecrets(secretsToRedact);
  return {
    entry: toPublicMetadata(stored),
    origin,
    payload,
  };
}

export function generateVaultTotp(params: {
  entryId: string;
  currentOrigin?: string;
  nowMs?: number;
  env?: NodeJS.ProcessEnv;
}): { code: string; entryId: string } {
  const env = params.env ?? process.env;
  const envelope = readVaultEnvelope(env);
  const stored = envelope.entries.find((e) => e.id === params.entryId);
  if (!stored) {
    throw new Error(`Credential Vault entry "${params.entryId}" not found.`);
  }
  if (params.currentOrigin !== undefined) {
    const origin = normalizeVaultOrigin(params.currentOrigin);
    if (!stored.allowedOrigins.includes(origin)) {
      throw new Error(
        `Credential Vault TOTP origin mismatch (fail-closed): "${origin}" is not allowed for "${params.entryId}".`,
      );
    }
  }
  const key = loadOrCreateMasterKey(env);
  const payload = decryptPayload(stored.encryptedPayload, key);
  if (!payload.totpSecret?.trim()) {
    throw new Error(`Credential Vault entry "${params.entryId}" has no TOTP secret configured.`);
  }
  const code = generateTotpCode(payload.totpSecret, params.nowMs);
  registerDynamicRedactionSecrets([payload.totpSecret, code]);
  return { code, entryId: stored.id };
}

/**
 * Builds a browser-context DOM autofill expression that synchronously re-asserts
 * `window.location.origin === expectedOrigin` and masks any JS exception so secrets
 * can never echo into browser error messages or logs.
 */
export function buildBrowserVaultFillExpression(params: {
  expectedOrigin: string;
  fields: Array<{ selector: string; value: string }>;
}): string {
  const serializedOrigin = JSON.stringify(normalizeVaultOrigin(params.expectedOrigin));
  const serializedFields = JSON.stringify(params.fields);
  return `(() => {
    try {
      if (window.location.origin !== ${serializedOrigin}) {
        return { ok: false, error: "Vault origin mismatch inside page context." };
      }
      const items = ${serializedFields};
      const filled = [];
      for (const item of items) {
        const el = document.querySelector(item.selector);
        if (!el) continue;
        el.focus();
        el.value = item.value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        filled.push(item.selector);
      }
      return { ok: filled.length > 0, filledFields: filled };
    } catch (_) {
      return { ok: false, error: "Vault DOM injection failed." };
    }
  })()`;
}
