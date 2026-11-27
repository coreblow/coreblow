export type PersistentSandboxProviderId = "daytona" | "e2b";

export type PersistentSandboxState = "creating" | "running" | "paused" | "destroyed" | "error";

export interface PersistentSandboxSessionHandle {
  readonly id: string;
  readonly provider: PersistentSandboxProviderId;
  readonly state: PersistentSandboxState;
  readonly createdAt: string;
  readonly endpoint?: string;
  readonly template?: string;
}

export interface SandboxFileEntry {
  readonly path: string;
  readonly content: string;
}

export interface SandboxExecOptions {
  readonly timeoutMs?: number;
  readonly cwd?: string;
  readonly env?: Record<string, string>;
  readonly maxOutputBytes?: number;
}

export interface SandboxExecResult {
  readonly success: boolean;
  readonly output: string;
  readonly exitCode: number;
  readonly durationMs: number;
  readonly error?: string;
}

export interface PersistentSandboxCreateOptions {
  readonly template?: string;
  readonly timeoutMs?: number;
  readonly env?: Record<string, string>;
  readonly metadata?: Record<string, string>;
}

export interface PersistentSandboxSession {
  readonly handle: PersistentSandboxSessionHandle;
  exec(command: string, opts?: SandboxExecOptions): Promise<SandboxExecResult>;
  syncFilesToSandbox(files: readonly SandboxFileEntry[]): Promise<void>;
  syncFilesFromSandbox(paths: readonly string[]): Promise<SandboxFileEntry[]>;
  pause(): Promise<PersistentSandboxSessionHandle>;
  resume(): Promise<PersistentSandboxSessionHandle>;
  destroy(): Promise<void>;
}

export interface PersistentSandboxProvider {
  readonly id: PersistentSandboxProviderId;
  isConfigured(): boolean;
  create(opts?: PersistentSandboxCreateOptions): Promise<PersistentSandboxSession>;
  connect(sessionId: string): Promise<PersistentSandboxSession>;
}

export const DEFAULT_SANDBOX_MAX_OUTPUT_BYTES = 64 * 1024;

const SECRET_PATTERNS: readonly RegExp[] = [
  /\bsk-ant-[A-Za-z0-9_-]{8,}\b/g,
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  /\b(?:ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/-]{12,}\b/gi,
];

/**
 * Validates that a sandbox file path is strictly relative and free of traversal segments.
 */
export function sanitizeSandboxPath(rawPath: string): string {
  const normalized = String(rawPath ?? "").replace(/\\/g, "/").trim();
  if (!normalized || normalized.includes("\0")) {
    throw new Error(`Invalid sandbox file path: ${JSON.stringify(rawPath)}`);
  }
  if (normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized)) {
    throw new Error(`Absolute host paths are not allowed in sandbox file sync: ${rawPath}`);
  }
  const parts = normalized.split("/").filter((part) => part.length > 0 && part !== ".");
  if (parts.length === 0 || parts.some((part) => part === "..")) {
    throw new Error(`Path traversal is not allowed in sandbox file sync: ${rawPath}`);
  }
  return parts.join("/");
}

/**
 * Scrubs known credential patterns and explicit secret values from outbound sandbox text.
 */
export function redactSandboxSecrets(
  text: string,
  extraSecrets: readonly (string | undefined)[] = [],
): string {
  let result = String(text ?? "");
  for (const secret of extraSecrets) {
    if (secret && secret.trim().length >= 4) {
      result = result.split(secret).join("[REDACTED]");
    }
  }
  for (const envKey of ["DAYTONA_API_KEY", "E2B_API_KEY"]) {
    const val = process.env[envKey];
    if (val && val.trim().length >= 4) {
      result = result.split(val).join("[REDACTED]");
    }
  }
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

/**
 * Caps sandbox output to a bounded UTF-8 byte length.
 */
export function capSandboxOutput(
  text: string,
  maxBytes: number = DEFAULT_SANDBOX_MAX_OUTPUT_BYTES,
): string {
  const limit = Math.max(256, maxBytes);
  const buf = Buffer.from(text, "utf8");
  if (buf.byteLength <= limit) {
    return text;
  }
  const truncated = buf.subarray(0, limit).toString("utf8");
  return `${truncated}\n...[truncated to ${limit} bytes]`;
}
