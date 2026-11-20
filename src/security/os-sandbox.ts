import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import os from "node:os";

export type SandboxMode = "off" | "regular" | "auto-allow";

export interface SandboxOptions {
  enabled?: boolean;
  mode?: SandboxMode;
  cwd?: string;
  allowWritePaths?: string[];
  protectedPaths?: string[];
  denyReadCredentials?: boolean;
  excludedCommands?: string[];
  failIfUnavailable?: boolean;
}

export interface SandboxAvailability {
  available: boolean;
  engine: "seatbelt" | "bwrap" | "none";
  details: string;
}

export interface SandboxedCommandResult {
  command: string;
  sandboxed: boolean;
  engine: "seatbelt" | "bwrap" | "none";
  reason?: string;
}

const DEFAULT_PROTECTED_PATHS = [
  ".coreblow",
  ".git/hooks",
  ".git/config",
  ".zshrc",
  ".bashrc",
  ".bash_profile",
  ".profile",
  ".coreblow/.env",
];

const DEFAULT_EXCLUDED_COMMANDS = [
  "docker",
  "docker *",
  "podman",
  "podman *",
];

/**
 * Checks if the underlying host OS supports sandbox-exec (macOS Seatbelt) or bwrap (Linux/WSL).
 */
export function checkSandboxAvailability(): SandboxAvailability {
  if (process.platform === "darwin") {
    const seatbeltPath = "/usr/bin/sandbox-exec";
    if (fs.existsSync(seatbeltPath)) {
      return {
        available: true,
        engine: "seatbelt",
        details: "Apple Seatbelt (sandbox-exec) active",
      };
    }
  }

  if (process.platform === "linux") {
    // Check if bwrap binary exists in standard PATHs
    const bwrapCandidates = ["/usr/bin/bwrap", "/bin/bwrap", "/usr/local/bin/bwrap"];
    for (const p of bwrapCandidates) {
      if (fs.existsSync(p)) {
        return {
          available: true,
          engine: "bwrap",
          details: `Bubblewrap (${p}) active`,
        };
      }
    }
    return {
      available: false,
      engine: "none",
      details: "Bubblewrap (bwrap) not found in system PATH",
    };
  }

  return {
    available: false,
    engine: "none",
    details: `OS sandboxing not supported on ${process.platform}`,
  };
}

/**
 * Generates an Apple Seatbelt profile for macOS sandbox-exec.
 */
export function generateSeatbeltProfile(options: SandboxOptions = {}): string {
  const cwd = path.resolve(options.cwd || process.cwd());
  const tmpDir = path.resolve(os.tmpdir());
  const home = os.homedir();

  const allowWrite = [
    cwd,
    tmpDir,
    ...(options.allowWritePaths || []).map((p) => path.resolve(cwd, p)),
  ];

  const protectedPaths = (options.protectedPaths || DEFAULT_PROTECTED_PATHS).map((p) => {
    if (p.startsWith("~")) return path.resolve(home, p.slice(1).replace(/^\/+/, ""));
    if (path.isAbsolute(p)) return p;
    return path.resolve(cwd, p);
  });

  const profileLines = [
    "(version 1)",
    "(debug deny)",
    "(allow default)",
  ];

  // Deny read for credentials if requested
  if (options.denyReadCredentials) {
    const sshDir = path.resolve(home, ".ssh");
    const awsDir = path.resolve(home, ".aws");
    profileLines.push(`(deny file-read* (subpath "${sshDir}"))`);
    profileLines.push(`(deny file-read* (subpath "${awsDir}"))`);
  }

  // Allow file writes only in cwd and temp directory
  profileLines.push("(deny file-write*)");
  for (const wPath of allowWrite) {
    profileLines.push(`(allow file-write* (subpath "${wPath}"))`);
  }

  // Explicitly deny writes to protected paths even inside writable directories
  for (const pPath of protectedPaths) {
    profileLines.push(`(deny file-write* (subpath "${pPath}"))`);
  }

  return profileLines.join("\n");
}

/**
 * Checks if command is in the sandbox exclusion list (e.g. docker *).
 */
export function isCommandExcludedFromSandbox(
  command: string,
  excludedList: string[] = DEFAULT_EXCLUDED_COMMANDS,
): boolean {
  const trimmed = command.trim();
  for (const pattern of excludedList) {
    if (pattern.endsWith(" *")) {
      const prefix = pattern.slice(0, -2);
      if (trimmed === prefix || trimmed.startsWith(`${prefix} `)) {
        return true;
      }
    } else if (trimmed === pattern || trimmed.startsWith(`${pattern} `)) {
      return true;
    }
  }
  return false;
}

/**
 * Wraps a shell command in OS-level sandbox isolation.
 */
export function buildSandboxedCommand(
  rawCommand: string,
  options: SandboxOptions = {},
): SandboxedCommandResult {
  if (options.enabled === false || options.mode === "off") {
    return {
      command: rawCommand,
      sandboxed: false,
      engine: "none",
      reason: "Sandbox disabled in configuration",
    };
  }

  if (isCommandExcludedFromSandbox(rawCommand, options.excludedCommands)) {
    return {
      command: rawCommand,
      sandboxed: false,
      engine: "none",
      reason: "Command matches sandbox exclusion rule",
    };
  }

  const availability = checkSandboxAvailability();
  if (!availability.available) {
    if (options.failIfUnavailable) {
      throw new Error(`Sandbox required but unavailable: ${availability.details}`);
    }
    return {
      command: rawCommand,
      sandboxed: false,
      engine: "none",
      reason: `Sandbox unavailable: ${availability.details}`,
    };
  }

  if (availability.engine === "seatbelt") {
    const profile = generateSeatbeltProfile(options);
    const escapedProfile = profile.replace(/'/g, "'\\''");
    const escapedCommand = rawCommand.replace(/'/g, "'\\''");
    const wrapped = `sandbox-exec -p '${escapedProfile}' bash -c '${escapedCommand}'`;
    return {
      command: wrapped,
      sandboxed: true,
      engine: "seatbelt",
    };
  }

  if (availability.engine === "bwrap") {
    const cwd = path.resolve(options.cwd || process.cwd());
    const home = os.homedir();
    const escapedCommand = rawCommand.replace(/'/g, "'\\''");
    // Bubblewrap bind-mounts / read-only except cwd and /tmp
    const wrapped = `bwrap --ro-bind / / --bind "${cwd}" "${cwd}" --bind /tmp /tmp --dev /dev --proc /proc bash -c '${escapedCommand}'`;
    return {
      command: wrapped,
      sandboxed: true,
      engine: "bwrap",
    };
  }

  return {
    command: rawCommand,
    sandboxed: false,
    engine: "none",
  };
}
