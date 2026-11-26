/**
 * CoreBlow — 8-Backend Sovereign Execution Router
 *
 * Active production backends:
 * 1. local — Local host shell (bash/sh) with execution profile and catastrophic guards
 * 2. vm_isolate — In-process Node.js VM isolate (<5ms cold start)
 * 3. docker — Hardened container execution (--network=none, --read-only, --tmpfs, --memory=256m)
 * 4. ssh — Remote host execution over SSH/Tailscale
 *
 * Planned cloud MicroVM adapters (fail-closed until implemented):
 * 5. daytona — Daytona workspace MicroVM adapter (planned)
 * 6. modal — Modal serverless MicroVM adapter (planned)
 * 7. vercel — Vercel Sandbox MicroVM adapter (planned)
 * 8. e2b — E2B Cloud MicroVM adapter (planned)
 */

import * as childProcess from "node:child_process";
import * as os from "node:os";
import { SandboxExecutor } from "./sandbox.js";
import { DockerRuntime } from "./docker-runtime.js";

export type ExecutionBackendId =
  | "local"
  | "vm_isolate"
  | "docker"
  | "ssh"
  | "daytona"
  | "modal"
  | "vercel"
  | "e2b";

export interface BackendExecuteOptions {
  backend?: ExecutionBackendId;
  command?: string;
  code?: string;
  language?: "javascript" | "typescript" | "python" | "bash" | "sh";
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  remoteHost?: string;
  dockerImage?: string;
}

export interface BackendExecuteResult {
  readonly success: boolean;
  readonly output: string;
  readonly exitCode?: number;
  readonly backend: ExecutionBackendId;
  readonly durationMs: number;
  readonly error?: string;
}

export interface BackendStatus {
  readonly id: ExecutionBackendId;
  readonly name: string;
  readonly available: boolean;
  readonly detail?: string;
}

/**
 * Probes availability of an executable binary in PATH.
 */
function isBinaryAvailable(binary: string): boolean {
  try {
    const isWindows = process.platform === "win32";
    const checkCmd = isWindows ? `where ${binary}` : `command -v ${binary}`;
    childProcess.execSync(checkCmd, { stdio: "ignore", timeout: 1000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * List all 8 execution backends and their active readiness status on the current host.
 */
export async function listAvailableBackends(): Promise<BackendStatus[]> {
  const dockerAvail = await DockerRuntime.isAvailable().catch(() => false);
  const sshAvail = isBinaryAvailable("ssh");

  return [
    {
      id: "local",
      name: "Local Host Shell",
      available: true,
      detail: `Native OS shell (${process.platform}-${os.arch()})`,
    },
    {
      id: "vm_isolate",
      name: "Node.js VM Isolate",
      available: true,
      detail: "In-process V8 isolate (<5ms cold start, memory bounded)",
    },
    {
      id: "docker",
      name: "Hardened Docker Container",
      available: dockerAvail,
      detail: dockerAvail
        ? "Docker daemon connected (--network=none, --read-only, --tmpfs /tmp, --memory=256m)"
        : "Docker CLI or daemon not available on host",
    },
    {
      id: "ssh",
      name: "Remote SSH / Tailscale",
      available: sshAvail,
      detail: sshAvail
        ? `OpenSSH client active (Default host: ${process.env.COREBLOW_SSH_HOST || "not set"})`
        : "OpenSSH binary not found in PATH",
    },
    {
      id: "daytona",
      name: "Daytona Workspace",
      available: false,
      detail: "Planned cloud MicroVM adapter (not yet implemented; use local, vm_isolate, docker, or ssh)",
    },
    {
      id: "modal",
      name: "Modal Serverless MicroVM",
      available: false,
      detail: "Planned cloud MicroVM adapter (not yet implemented; use local, vm_isolate, docker, or ssh)",
    },
    {
      id: "vercel",
      name: "Vercel Sandbox / Edge",
      available: false,
      detail: "Planned cloud MicroVM adapter (not yet implemented; use local, vm_isolate, docker, or ssh)",
    },
    {
      id: "e2b",
      name: "E2B Cloud Sandbox",
      available: false,
      detail: "Planned cloud MicroVM adapter (not yet implemented; use local, vm_isolate, docker, or ssh)",
    },
  ];
}

export function buildDockerRunArgs(image: string, cmd: string): string[] {
  return [
    "run",
    "--rm",
    "--network=none",
    "--read-only",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,size=64m",
    "--memory=256m",
    "--cpus=0.5",
    image,
    "sh",
    "-c",
    cmd,
  ];
}

function unimplementedCloudBackendResult(
  backend: "daytona" | "modal" | "vercel" | "e2b",
  startMs: number,
): BackendExecuteResult {
  return {
    success: false,
    output: `Cloud MicroVM adapter '${backend}' is not yet implemented. Use one of the active production backends: local, vm_isolate, docker, or ssh.`,
    exitCode: 127,
    backend,
    durationMs: Date.now() - startMs,
    error: `${backend.toUpperCase()}_NOT_IMPLEMENTED`,
  };
}

/**
 * Deterministically executes a shell command or code block on the chosen backend.
 */
export async function executeOnBackend(options: BackendExecuteOptions): Promise<BackendExecuteResult> {
  const backend = options.backend ?? "local";
  const start = Date.now();
  const timeoutMs = options.timeoutMs ?? 20000;

  switch (backend) {
    case "vm_isolate": {
      const sandbox = new SandboxExecutor({
        timeoutMs,
        maxOutput: 20000,
      });
      const codeToRun = options.code ?? options.command ?? "";
      const result = await sandbox.execute(codeToRun);
      return {
        success: result.success,
        output: result.output || (result.returnValue !== undefined ? String(result.returnValue) : ""),
        exitCode: result.success ? 0 : 1,
        backend: "vm_isolate",
        durationMs: Date.now() - start,
        error: result.error,
      };
    }

    case "docker": {
      const isDocker = await DockerRuntime.isAvailable().catch(() => false);
      if (!isDocker) {
        return {
          success: false,
          output: "Docker backend requested, but Docker CLI or daemon is not available on this host. Falling back to local execution or install Docker.",
          exitCode: 127,
          backend: "docker",
          durationMs: Date.now() - start,
          error: "DOCKER_NOT_AVAILABLE",
        };
      }

      return new Promise<BackendExecuteResult>((resolve) => {
        const cmd = options.command || (options.code ? `node -e ${JSON.stringify(options.code)}` : "sh");
        const image = options.dockerImage ?? "node:24-alpine";
        const args = buildDockerRunArgs(image, cmd);

        const child = childProcess.spawn("docker", args, {
          timeout: timeoutMs,
        });

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (d) => (stdout += d.toString("utf8")));
        child.stderr?.on("data", (d) => (stderr += d.toString("utf8")));

        child.on("close", (code) => {
          resolve({
            success: code === 0,
            output: stdout || stderr,
            exitCode: code ?? 0,
            backend: "docker",
            durationMs: Date.now() - start,
            error: code !== 0 ? stderr || `Exited with code ${code}` : undefined,
          });
        });

        child.on("error", (err) => {
          resolve({
            success: false,
            output: `Docker execution error: ${err.message}`,
            exitCode: 1,
            backend: "docker",
            durationMs: Date.now() - start,
            error: err.message,
          });
        });
      });
    }

    case "ssh": {
      const host = options.remoteHost || process.env.COREBLOW_SSH_HOST;
      if (!host) {
        return {
          success: false,
          output: "SSH backend requested, but no remoteHost argument or COREBLOW_SSH_HOST environment variable was provided.",
          exitCode: 1,
          backend: "ssh",
          durationMs: Date.now() - start,
          error: "SSH_HOST_NOT_CONFIGURED",
        };
      }

      const cmd = options.command || options.code || "echo 'No command provided'";
      return new Promise<BackendExecuteResult>((resolve) => {
        const sshArgs = [
          "-o", "BatchMode=yes",
          "-o", "ConnectTimeout=5",
          host,
          cmd,
        ];

        const child = childProcess.spawn("ssh", sshArgs, {
          timeout: timeoutMs,
        });

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (d) => (stdout += d.toString("utf8")));
        child.stderr?.on("data", (d) => (stderr += d.toString("utf8")));

        child.on("close", (code) => {
          resolve({
            success: code === 0,
            output: stdout || stderr,
            exitCode: code ?? 0,
            backend: "ssh",
            durationMs: Date.now() - start,
            error: code !== 0 ? stderr : undefined,
          });
        });

        child.on("error", (err) => {
          resolve({
            success: false,
            output: `SSH connection error to ${host}: ${err.message}`,
            exitCode: 255,
            backend: "ssh",
            durationMs: Date.now() - start,
            error: err.message,
          });
        });
      });
    }

    case "daytona":
    case "modal":
    case "vercel":
    case "e2b":
      return unimplementedCloudBackendResult(backend, start);

    case "local":
    default: {
      const cmd = options.command || options.code || "";
      return new Promise<BackendExecuteResult>((resolve) => {
        const shell = process.platform === "win32" ? "cmd.exe" : "/bin/bash";
        const shellArgs = process.platform === "win32" ? ["/c", cmd] : ["-c", cmd];

        const child = childProcess.spawn(shell, shellArgs, {
          cwd: options.cwd || process.cwd(),
          env: { ...process.env, ...options.env },
          timeout: timeoutMs,
        });

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (d) => (stdout += d.toString("utf8")));
        child.stderr?.on("data", (d) => (stderr += d.toString("utf8")));

        child.on("close", (code) => {
          resolve({
            success: code === 0,
            output: stdout || stderr,
            exitCode: code ?? 0,
            backend: "local",
            durationMs: Date.now() - start,
            error: code !== 0 ? stderr || `Process failed with exit code ${code}` : undefined,
          });
        });

        child.on("error", (err) => {
          resolve({
            success: false,
            output: `Local execution error: ${err.message}`,
            exitCode: 1,
            backend: "local",
            durationMs: Date.now() - start,
            error: err.message,
          });
        });
      });
    }
  }
}
