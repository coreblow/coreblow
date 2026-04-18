/**
 * CoreBlow — Shell Environment Probe
 *
 * Probes the user's login shell to extract environment variables
 * that may not be available when launched from a GUI/desktop context.
 * This ensures PATH and API keys set in .bashrc/.zshrc are available.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isTruthyEnvValue } from './env.js';

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BUFFER = 2 * 1024 * 1024;
const DEFAULT_SHELL = '/bin/sh';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ShellEnvProbeResult {
  ok: boolean;
  shellEnv?: Map<string, string>;
  error?: string;
}

export interface ShellEnvFallbackResult {
  ok: boolean;
  applied: string[];
  skippedReason?: 'disabled' | 'already-has-keys';
  error?: string;
}

export interface ShellEnvFallbackOptions {
  enabled: boolean;
  env: NodeJS.ProcessEnv;
  expectedKeys: string[];
  logger?: Pick<typeof console, 'warn'>;
  timeoutMs?: number;
  exec?: typeof execFileSync;
}

// ─── Caches ─────────────────────────────────────────────────────────────────

let cachedShellPath: string | null | undefined;
let cachedTrustedShells: Set<string> | null | undefined;
let lastAppliedKeys: string[] = [];

// ─── Shell Trust ────────────────────────────────────────────────────────────

function readRegisteredShells(): Set<string> | null {
  if (cachedTrustedShells !== undefined) return cachedTrustedShells;
  try {
    const raw = fs.readFileSync('/etc/shells', 'utf8');
    const entries = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#') && path.isAbsolute(l));
    cachedTrustedShells = new Set(entries);
  } catch {
    cachedTrustedShells = null;
  }
  return cachedTrustedShells;
}

function isShellTrusted(shellPath: string): boolean {
  if (!path.isAbsolute(shellPath)) return false;
  if (path.normalize(shellPath) !== shellPath) return false;
  const registered = readRegisteredShells();
  return registered?.has(shellPath) === true;
}

function resolveShell(env: NodeJS.ProcessEnv): string {
  const shell = env.SHELL?.trim();
  if (shell && isShellTrusted(shell)) return shell;
  return DEFAULT_SHELL;
}

// ─── Env Sanitization ───────────────────────────────────────────────────────

function buildSafeExecEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const safe = { ...env };
  // Pin HOME to real user home to prevent startup-file redirection
  const home = os.homedir().trim();
  if (home) {
    safe.HOME = home;
  } else {
    delete safe.HOME;
  }
  // Prevent zsh startup-file hijack
  delete safe.ZDOTDIR;
  return safe;
}

// ─── Probe ──────────────────────────────────────────────────────────────────

function parseNullDelimitedEnv(stdout: Buffer): Map<string, string> {
  const result = new Map<string, string>();
  const parts = stdout.toString('utf8').split('\0');

  for (const part of parts) {
    if (!part) continue;
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    if (key) result.set(key, value);
  }

  return result;
}

/**
 * Execute a login shell and capture its environment via `env -0`.
 */
function probeLoginShell(params: {
  env: NodeJS.ProcessEnv;
  timeoutMs?: number;
  exec?: typeof execFileSync;
}): ShellEnvProbeResult {
  const exec = params.exec ?? execFileSync;
  const timeoutMs = Math.max(0, params.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const shell = resolveShell(params.env);
  const safeEnv = buildSafeExecEnv(params.env);

  try {
    const stdout = exec(shell, ['-l', '-c', 'env -0'], {
      encoding: 'buffer',
      timeout: timeoutMs,
      maxBuffer: DEFAULT_MAX_BUFFER,
      env: safeEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, shellEnv: parseNullDelimitedEnv(stdout) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Load missing environment variables from the user's login shell.
 *
 * Only fills keys listed in `expectedKeys` that are not already set.
 * This is useful when CoreBlow is launched from a context that doesn't
 * inherit shell profile settings (e.g., GUI app, systemd service).
 */
export function loadShellEnvFallback(opts: ShellEnvFallbackOptions): ShellEnvFallbackResult {
  const logger = opts.logger ?? console;

  if (!opts.enabled) {
    lastAppliedKeys = [];
    return { ok: true, applied: [], skippedReason: 'disabled' };
  }

  // Skip if any expected key is already present
  const hasAny = opts.expectedKeys.some((k) => Boolean(opts.env[k]?.trim()));
  if (hasAny) {
    lastAppliedKeys = [];
    return { ok: true, applied: [], skippedReason: 'already-has-keys' };
  }

  const probe = probeLoginShell({
    env: opts.env,
    timeoutMs: opts.timeoutMs,
    exec: opts.exec,
  });

  if (!probe.ok || !probe.shellEnv) {
    const error = probe.error ?? 'Unknown probe failure';
    logger.warn(`[coreblow] shell env fallback failed: ${error}`);
    lastAppliedKeys = [];
    return { ok: false, applied: [], error };
  }

  const applied: string[] = [];
  for (const key of opts.expectedKeys) {
    if (opts.env[key]?.trim()) continue;
    const value = probe.shellEnv.get(key);
    if (!value?.trim()) continue;
    opts.env[key] = value;
    applied.push(key);
  }

  lastAppliedKeys = applied;
  return { ok: true, applied };
}

/** Check if shell env fallback is enabled via COREBLOW_LOAD_SHELL_ENV */
export function shouldEnableShellEnvFallback(env: NodeJS.ProcessEnv): boolean {
  return isTruthyEnvValue(env.COREBLOW_LOAD_SHELL_ENV);
}

/** Check if shell env fallback should be deferred */
export function shouldDeferShellEnvFallback(env: NodeJS.ProcessEnv): boolean {
  return isTruthyEnvValue(env.COREBLOW_DEFER_SHELL_ENV_FALLBACK);
}

/** Resolve timeout for shell env fallback from env or default */
export function resolveShellEnvFallbackTimeoutMs(env: NodeJS.ProcessEnv): number {
  const raw = env.COREBLOW_SHELL_ENV_TIMEOUT_MS?.trim();
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : DEFAULT_TIMEOUT_MS;
}

/**
 * Extract the PATH from the login shell environment.
 * Returns null on Windows or if the probe fails.
 */
export function getShellPathFromLoginShell(opts: {
  env: NodeJS.ProcessEnv;
  timeoutMs?: number;
  exec?: typeof execFileSync;
  platform?: NodeJS.Platform;
}): string | null {
  if (cachedShellPath !== undefined) return cachedShellPath;

  const platform = opts.platform ?? process.platform;
  if (platform === 'win32') {
    cachedShellPath = null;
    return null;
  }

  const probe = probeLoginShell({
    env: opts.env,
    timeoutMs: opts.timeoutMs,
    exec: opts.exec,
  });

  if (!probe.ok || !probe.shellEnv) {
    cachedShellPath = null;
    return null;
  }

  const shellPath = probe.shellEnv.get('PATH')?.trim();
  cachedShellPath = shellPath && shellPath.length > 0 ? shellPath : null;
  return cachedShellPath;
}

/** Get the list of keys applied during the last fallback run */
export function getShellEnvAppliedKeys(): string[] {
  return [...lastAppliedKeys];
}

/** Reset caches (for testing only) */
export function resetShellEnvCacheForTests(): void {
  cachedShellPath = undefined;
  cachedTrustedShells = undefined;
  lastAppliedKeys = [];
}
