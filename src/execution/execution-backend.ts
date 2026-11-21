import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { exec, execFile } from "node:child_process";
import { buildSandboxedCommand, checkSandboxAvailability } from "../security/os-sandbox.js";
import { isDangerousShellCommand } from "../tui/ink/input-prefixes.js";

export type ExecutionBackendType = "local" | "sandbox" | "docker" | "ssh" | "node" | "cloud";

export interface ExecutionBackendConfig {
  type: ExecutionBackendType;
  target?: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
  dockerNetworkNone?: boolean;
  sshKeyPath?: string;
  sshPort?: number;
  cloudToken?: string;
  cloudEndpoint?: string;
}

export interface BackendExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  backend: ExecutionBackendType;
  target?: string;
  sandboxed?: boolean;
}

export interface BackendProbeResult {
  type: ExecutionBackendType;
  available: boolean;
  status: "available" | "unconfigured" | "unavailable";
  details: string;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_OUTPUT_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Format active backend badge for StatusBar and WelcomeHero.
 */
export function formatBackendBadge(type: ExecutionBackendType, target?: string): string {
  switch (type) {
    case "local":
      return "Local";
    case "sandbox":
      return "Sandbox";
    case "docker": {
      const img = target?.trim() || "node:22-slim";
      const shortImg = img.split("/").pop() || img;
      return `Docker:${shortImg}`;
    }
    case "ssh":
      return `SSH:${target?.trim() || "host"}`;
    case "node":
      return `Node:${target?.trim() || "paired"}`;
    case "cloud":
      return `Cloud:${target?.trim() || "remote"}`;
    default:
      return "Local";
  }
}

/**
 * Checks command existence in PATH.
 */
function isBinaryInPath(bin: string): Promise<boolean> {
  const checkCmd = process.platform === "win32" ? `where ${bin}` : `command -v ${bin}`;
  return new Promise((resolve) => {
    exec(checkCmd, { timeout: 3000 }, (error, stdout) => {
      resolve(!error && Boolean(stdout.trim()));
    });
  });
}

/**
 * Probes availability of a specific execution backend.
 */
export async function probeBackendAvailability(
  type: ExecutionBackendType,
  config?: ExecutionBackendConfig,
): Promise<BackendProbeResult> {
  switch (type) {
    case "local":
      return {
        type: "local",
        available: true,
        status: "available",
        details: "Direct host shell execution",
      };

    case "sandbox": {
      const avail = checkSandboxAvailability();
      return {
        type: "sandbox",
        available: avail.available,
        status: avail.available ? "available" : "unavailable",
        details: avail.details,
      };
    }

    case "docker": {
      const hasDocker = await isBinaryInPath("docker");
      if (!hasDocker) {
        return {
          type: "docker",
          available: false,
          status: "unavailable",
          details: "Docker binary not found in system PATH",
        };
      }
      return new Promise((resolve) => {
        exec("docker info", { timeout: 4000 }, (err) => {
          if (err) {
            resolve({
              type: "docker",
              available: false,
              status: "unavailable",
              details: "Docker daemon not running or socket inaccessible",
            });
          } else {
            resolve({
              type: "docker",
              available: true,
              status: "available",
              details: `Docker container isolation (${config?.target || "node:22-slim"})`,
            });
          }
        });
      });
    }

    case "ssh": {
      const hasSsh = await isBinaryInPath("ssh");
      if (!hasSsh) {
        return {
          type: "ssh",
          available: false,
          status: "unavailable",
          details: "SSH client binary not found in system PATH",
        };
      }
      const target = config?.target?.trim();
      if (!target) {
        return {
          type: "ssh",
          available: false,
          status: "unconfigured",
          details: "SSH host target not specified (e.g. user@host or SSH alias)",
        };
      }
      return {
        type: "ssh",
        available: true,
        status: "available",
        details: `SSH remote execution on ${target}`,
      };
    }

    case "node": {
      const target = config?.target?.trim();
      try {
        const { listNodePairing } = await import("../infra/node-pairing.js");
        const list = await listNodePairing();
        const hasPaired = list.paired.length > 0;
        if (!hasPaired && !target) {
          return {
            type: "node",
            available: false,
            status: "unconfigured",
            details: "No CoreBlow remote nodes paired. Pair via `coreblow nodes pair`.",
          };
        }
        return {
          type: "node",
          available: true,
          status: "available",
          details: `CoreBlow paired node execution (${target || `${list.paired.length} nodes paired`})`,
        };
      } catch {
        return {
          type: "node",
          available: Boolean(target),
          status: target ? "available" : "unconfigured",
          details: target ? `Node ${target}` : "CoreBlow node pairing store not initialized",
        };
      }
    }

    case "cloud": {
      const endpoint =
        config?.cloudEndpoint?.trim() ||
        process.env.COREBLOW_CLOUD_SANDBOX_URL?.trim();
      if (!endpoint) {
        return {
          type: "cloud",
          available: false,
          status: "unconfigured",
          details: "Cloud runner endpoint not set (set COREBLOW_CLOUD_SANDBOX_URL in ~/.coreblow/.env)",
        };
      }
      return {
        type: "cloud",
        available: true,
        status: "available",
        details: `Remote cloud sandbox runner at ${endpoint}`,
      };
    }
  }
}

/**
 * Escapes a command string for safe single-quoted shell embedding.
 */
export function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * Dispatches command execution to the requested backend target.
 */
export async function executeCommandOnBackend(
  command: string,
  config: ExecutionBackendConfig = { type: "local" },
  options: {
    cwd?: string;
    env?: Record<string, string>;
    abortSignal?: AbortSignal;
    fetchFn?: typeof fetch;
  } = {},
): Promise<BackendExecutionResult> {
  const startTime = Date.now();
  const cwd = path.resolve(options.cwd || process.cwd());
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = config.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;

  // 1. Dangerous command check
  const danger = isDangerousShellCommand(command);
  if (danger.dangerous) {
    throw new Error(danger.reason || `Command rejected by CoreBlow safety guard: ${command}`);
  }

  // 2. Local execution
  if (config.type === "local") {
    return new Promise((resolve, reject) => {
      const child = exec(
        command,
        {
          cwd,
          env: { ...process.env, ...options.env },
          timeout: timeoutMs,
          maxBuffer: maxBytes,
        },
        (error, stdout, stderr) => {
          resolve({
            stdout: stdout || "",
            stderr: stderr || "",
            exitCode: error && typeof error.code === "number" ? error.code : error ? 1 : 0,
            durationMs: Date.now() - startTime,
            backend: "local",
          });
        },
      );

      if (options.abortSignal) {
        options.abortSignal.addEventListener("abort", () => {
          child.kill("SIGTERM");
          reject(new Error("Command aborted"));
        });
      }
    });
  }

  // 3. OS-level Sandbox execution
  if (config.type === "sandbox") {
    const sandboxed = buildSandboxedCommand(command, {
      enabled: true,
      mode: "regular",
      cwd,
    });

    return new Promise((resolve, reject) => {
      const child = exec(
        sandboxed.command,
        {
          cwd,
          env: { ...process.env, ...options.env },
          timeout: timeoutMs,
          maxBuffer: maxBytes,
        },
        (error, stdout, stderr) => {
          resolve({
            stdout: stdout || "",
            stderr: stderr || "",
            exitCode: error && typeof error.code === "number" ? error.code : error ? 1 : 0,
            durationMs: Date.now() - startTime,
            backend: "sandbox",
            sandboxed: sandboxed.sandboxed,
          });
        },
      );

      if (options.abortSignal) {
        options.abortSignal.addEventListener("abort", () => {
          child.kill("SIGTERM");
          reject(new Error("Command aborted"));
        });
      }
    });
  }

  // 4. Docker container execution
  if (config.type === "docker") {
    const image = config.target?.trim() || "node:22-slim";
    const netArg = config.dockerNetworkNone ? "--network=none" : "";
    const containerWorkdir = "/workspace";
    const quotedCommand = escapeShellArg(command);

    const dockerArgs = [
      "run",
      "--rm",
      "-v",
      `${cwd}:${containerWorkdir}`,
      "-w",
      containerWorkdir,
      ...(netArg ? [netArg] : []),
      image,
      "bash",
      "-c",
      command,
    ];

    return new Promise((resolve, reject) => {
      const child = execFile(
        "docker",
        dockerArgs,
        {
          timeout: timeoutMs,
          maxBuffer: maxBytes,
        },
        (error, stdout, stderr) => {
          resolve({
            stdout: stdout || "",
            stderr: stderr || "",
            exitCode: error && typeof error.code === "number" ? error.code : error ? 1 : 0,
            durationMs: Date.now() - startTime,
            backend: "docker",
            target: image,
          });
        },
      );

      if (options.abortSignal) {
        options.abortSignal.addEventListener("abort", () => {
          child.kill("SIGTERM");
          reject(new Error("Command aborted"));
        });
      }
    });
  }

  // 5. SSH remote execution
  if (config.type === "ssh") {
    const target = config.target?.trim();
    if (!target) {
      throw new Error("SSH backend requires target host (e.g. user@host or SSH config alias)");
    }

    const sshArgs = ["-o", "BatchMode=yes"];
    if (config.sshPort) {
      sshArgs.push("-p", String(config.sshPort));
    }
    if (config.sshKeyPath) {
      sshArgs.push("-i", config.sshKeyPath);
    }
    sshArgs.push(target);
    sshArgs.push(`bash -c ${escapeShellArg(command)}`);

    return new Promise((resolve, reject) => {
      const child = execFile(
        "ssh",
        sshArgs,
        {
          timeout: timeoutMs,
          maxBuffer: maxBytes,
        },
        (error, stdout, stderr) => {
          resolve({
            stdout: stdout || "",
            stderr: stderr || "",
            exitCode: error && typeof error.code === "number" ? error.code : error ? 1 : 0,
            durationMs: Date.now() - startTime,
            backend: "ssh",
            target,
          });
        },
      );

      if (options.abortSignal) {
        options.abortSignal.addEventListener("abort", () => {
          child.kill("SIGTERM");
          reject(new Error("Command aborted"));
        });
      }
    });
  }

  // 6. Node (CoreBlow Paired Remote Node)
  if (config.type === "node") {
    const targetNode = config.target?.trim();
    try {
      const { executeNodeHostCommand } = await import("../agents/bash-tools.exec-host-node.js");
      const result = await executeNodeHostCommand({
        command,
        workdir: cwd,
        env: { ...process.env, ...options.env } as Record<string, string>,
        requestedNode: targetNode,
        security: "allowlist",
        ask: "off",
        defaultTimeoutSec: Math.ceil(timeoutMs / 1000),
        approvalRunningNoticeMs: 2000,
        warnings: [],
      });

      const out = typeof result?.content === "string" ? result.content : "";
      return {
        stdout: out,
        stderr: "",
        exitCode: 0,
        durationMs: Date.now() - startTime,
        backend: "node",
        target: targetNode,
      };
    } catch (err) {
      return {
        stdout: "",
        stderr: String(err),
        exitCode: 1,
        durationMs: Date.now() - startTime,
        backend: "node",
        target: targetNode,
      };
    }
  }

  // 7. Cloud Sandbox execution
  if (config.type === "cloud") {
    const endpoint =
      config.cloudEndpoint?.trim() ||
      process.env.COREBLOW_CLOUD_SANDBOX_URL?.trim();
    if (!endpoint) {
      throw new Error(
        "Cloud execution backend unconfigured. Set COREBLOW_CLOUD_SANDBOX_URL in ~/.coreblow/.env or pass --backend-target <url>.",
      );
    }

    const token = config.cloudToken?.trim() || process.env.COREBLOW_CLOUD_TOKEN?.trim() || "";
    const fetcher = options.fetchFn ?? fetch;

    try {
      const res = await fetcher(`${endpoint.replace(/\/+$/, "")}/api/exec`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          command,
          cwd,
          timeoutMs,
        }),
        signal: options.abortSignal ?? AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) {
        const errText = await res.text();
        return {
          stdout: "",
          stderr: `Cloud execution failed HTTP ${res.status}: ${errText}`,
          exitCode: 1,
          durationMs: Date.now() - startTime,
          backend: "cloud",
          target: endpoint,
        };
      }

      const data = (await res.json()) as any;
      return {
        stdout: data.stdout || "",
        stderr: data.stderr || "",
        exitCode: typeof data.exitCode === "number" ? data.exitCode : 0,
        durationMs: Date.now() - startTime,
        backend: "cloud",
        target: endpoint,
      };
    } catch (err) {
      return {
        stdout: "",
        stderr: `Cloud connection error: ${String(err)}`,
        exitCode: 1,
        durationMs: Date.now() - startTime,
        backend: "cloud",
        target: endpoint,
      };
    }
  }

  throw new Error(`Unsupported execution backend: ${String((config as any).type)}`);
}
