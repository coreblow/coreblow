/**
 * CoreBlow — DotEnv Loader
 *
 * Secure .env file loading with key filtering to prevent
 * privilege escalation via environment variable injection.
 * Respects existing process.env values (no overwrite).
 */

import fs from 'node:fs';
import path from 'node:path';

// ─── Security Blocklists ────────────────────────────────────────────────────

/** Keys that must NEVER be loaded from any .env source */
const RUNTIME_BLOCKED_KEYS = new Set([
  'NODE_OPTIONS',
  'NODE_TLS_REJECT_UNAUTHORIZED',
  'LD_PRELOAD',
  'DYLD_INSERT_LIBRARIES',
  'ELECTRON_RUN_AS_NODE',
]);

/** Additional keys blocked from workspace-level .env files */
const WORKSPACE_BLOCKED_KEYS = new Set([
  'ALL_PROXY',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'COREBLOW_HOME',
  'COREBLOW_CONFIG_PATH',
  'COREBLOW_STATE_DIR',
  'COREBLOW_AGENT_DIR',
  'COREBLOW_OAUTH_DIR',
  'COREBLOW_PROFILE',
]);

/** Suffix patterns blocked from workspace .env */
const BLOCKED_WORKSPACE_SUFFIXES = ['_BASE_URL'] as const;

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface DotEnvLoadOptions {
  /** Suppress warnings on read/parse errors. Default: true */
  quiet?: boolean;
}

export interface DotEnvLoaderConfig {
  /** Root directory for resolving ~/.coreblow/.env fallback */
  configDir?: string;
  /** Custom env target (default: process.env) */
  env?: NodeJS.ProcessEnv;
}

// ─── Parser ─────────────────────────────────────────────────────────────────

/**
 * Minimal .env parser. Handles KEY=VALUE, quoted values,
 * inline comments, and multiline (double-quoted) values.
 */
export function parseDotEnv(content: string): Map<string, string> {
  const result = new Map<string, string>();
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;

    const key = line.slice(0, eqIndex).trim();
    if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let value = line.slice(eqIndex + 1).trim();

    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Strip inline comments (unquoted)
    const commentIndex = value.indexOf(' #');
    if (commentIndex >= 0 && !rawLine.slice(eqIndex + 1).trim().startsWith('"')) {
      value = value.slice(0, commentIndex).trim();
    }

    result.set(key, value);
  }

  return result;
}

// ─── Key Filtering ──────────────────────────────────────────────────────────

function isRuntimeBlockedKey(key: string): boolean {
  return RUNTIME_BLOCKED_KEYS.has(key.toUpperCase());
}

function isWorkspaceBlockedKey(key: string): boolean {
  const upper = key.toUpperCase();
  if (isRuntimeBlockedKey(upper)) return true;
  if (WORKSPACE_BLOCKED_KEYS.has(upper)) return true;
  return BLOCKED_WORKSPACE_SUFFIXES.some((suffix) => upper.endsWith(suffix));
}

export type KeyBlockPredicate = (key: string) => boolean;

// ─── Core Loader ────────────────────────────────────────────────────────────

/**
 * Load a single .env file into the target environment.
 * Existing keys are NEVER overwritten (first-writer-wins).
 */
export function loadDotEnvFile(
  filePath: string,
  shouldBlock: KeyBlockPredicate,
  env: NodeJS.ProcessEnv = process.env,
  opts?: DotEnvLoadOptions,
): string[] {
  const quiet = opts?.quiet ?? true;
  const applied: string[] = [];

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err: unknown) {
    if (!quiet) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : undefined;
      if (code !== 'ENOENT') {
        console.warn(`[coreblow:dotenv] Failed to read ${filePath}: ${String(err)}`);
      }
    }
    return applied;
  }

  let parsed: Map<string, string>;
  try {
    parsed = parseDotEnv(content);
  } catch (err) {
    if (!quiet) {
      console.warn(`[coreblow:dotenv] Failed to parse ${filePath}: ${String(err)}`);
    }
    return applied;
  }

  for (const [key, value] of parsed) {
    if (shouldBlock(key)) continue;
    if (env[key] !== undefined) continue;
    env[key] = value;
    applied.push(key);
  }

  return applied;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Load a runtime-level .env file (global CoreBlow config).
 * Only runtime-dangerous keys are blocked.
 */
export function loadRuntimeDotEnvFile(filePath: string, opts?: DotEnvLoadOptions): string[] {
  return loadDotEnvFile(filePath, isRuntimeBlockedKey, process.env, opts);
}

/**
 * Load a workspace-level .env file (project directory).
 * Both runtime-dangerous and workspace-dangerous keys are blocked.
 */
export function loadWorkspaceDotEnvFile(filePath: string, opts?: DotEnvLoadOptions): string[] {
  return loadDotEnvFile(filePath, isWorkspaceBlockedKey, process.env, opts);
}

/**
 * Load .env files in standard CoreBlow resolution order:
 * 1. Workspace .env (cwd) — workspace-level blocking
 * 2. Global ~/.coreblow/.env — runtime-level blocking
 * Neither overrides already-set env vars.
 */
export function loadDotEnv(config?: DotEnvLoaderConfig, opts?: DotEnvLoadOptions): void {
  const quiet = opts?.quiet ?? true;
  const env = config?.env ?? process.env;
  const configDir = config?.configDir ?? resolveDefaultConfigDir(env);

  // 1. Workspace .env
  const cwdEnvPath = path.join(process.cwd(), '.env');
  loadDotEnvFile(cwdEnvPath, isWorkspaceBlockedKey, env, { quiet });

  // 2. Global fallback
  if (configDir) {
    const globalEnvPath = path.join(configDir, '.env');
    loadDotEnvFile(globalEnvPath, isRuntimeBlockedKey, env, { quiet });
  }
}

/** Resolve default CoreBlow config directory */
function resolveDefaultConfigDir(env: NodeJS.ProcessEnv): string | null {
  const stateDir = env.COREBLOW_STATE_DIR?.trim();
  if (stateDir) return stateDir;

  const home = env.HOME?.trim() || env.USERPROFILE?.trim();
  if (!home) return null;
  return path.join(home, '.coreblow');
}
