/**
 * CoreBlow — Browser Open Utility
 *
 * Cross-platform utility to open URLs in the system default browser.
 * Supports macOS (open), Linux (xdg-open), and Windows (start).
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BrowserOpenOptions {
  /** Override the platform detection. Default: process.platform */
  platform?: NodeJS.Platform;
  /** Timeout in ms for the open command. Default: 10_000 */
  timeoutMs?: number;
  /** If true, don't throw on failure. Default: false */
  silent?: boolean;
}

export interface BrowserOpenResult {
  success: boolean;
  command?: string;
  error?: string;
}

// ─── Platform Resolution ────────────────────────────────────────────────────

interface PlatformCommand {
  bin: string;
  args: string[];
}

function resolvePlatformCommand(url: string, platform: NodeJS.Platform): PlatformCommand | null {
  switch (platform) {
    case 'darwin':
      return { bin: '/usr/bin/open', args: [url] };
    case 'linux':
      return { bin: 'xdg-open', args: [url] };
    case 'win32':
      return { bin: 'cmd.exe', args: ['/c', 'start', '', url.replace(/&/g, '^&')] };
    default:
      return null;
  }
}

// ─── Validation ─────────────────────────────────────────────────────────────

function isValidBrowserUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Open a URL in the system default browser.
 *
 * Only http:// and https:// URLs are allowed for security.
 * Returns a result object indicating success or failure.
 */
export async function openInBrowser(
  url: string,
  options?: BrowserOpenOptions,
): Promise<BrowserOpenResult> {
  const platform = options?.platform ?? process.platform;
  const timeoutMs = options?.timeoutMs ?? 10_000;
  const silent = options?.silent ?? false;

  if (!isValidBrowserUrl(url)) {
    const error = `Invalid browser URL: only http/https allowed. Got: ${url}`;
    if (!silent) throw new Error(error);
    return { success: false, error };
  }

  const cmd = resolvePlatformCommand(url, platform);
  if (!cmd) {
    const error = `Unsupported platform for browser open: ${platform}`;
    if (!silent) throw new Error(error);
    return { success: false, error };
  }

  try {
    await execFileAsync(cmd.bin, cmd.args, {
      timeout: timeoutMs,
      stdio: 'ignore',
      windowsHide: true,
    });
    return { success: true, command: `${cmd.bin} ${cmd.args.join(' ')}` };
  } catch (err) {
    const error = `Browser open failed: ${err instanceof Error ? err.message : String(err)}`;
    if (!silent) throw new Error(error);
    return { success: false, error };
  }
}
