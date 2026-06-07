import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { promisify } from "node:util";
import type { PluginLogger } from "coreblow/plugin-sdk/plugin-entry";
import { isWSL2Sync } from "coreblow/plugin-sdk/runtime-env";

const execFileAsync = promisify(execFile);
const SYSTEMCTL_TIMEOUT_MS = 5_000;
const WSL_CUDA_MARKERS = [
  "/dev/dxg",
  "/usr/lib/wsl/lib/nvidia-smi",
  "/usr/lib/wsl/lib/libcuda.so.1",
  "/usr/local/cuda",
];

export function parseSystemctlShowProperties(stdout: string): Map<string, string> {
  const properties = new Map<string, string>();
  for (const line of stdout.split(/\r?\n/u)) {
    const separator = line.indexOf("=");
    if (separator > 0) {
      properties.set(line.slice(0, separator), line.slice(separator + 1));
    }
  }
  return properties;
}

export async function isOllamaEnabledWithRestartAlways(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(
      "systemctl",
      ["show", "ollama.service", "--property=UnitFileState,Restart", "--no-pager"],
      { timeout: SYSTEMCTL_TIMEOUT_MS },
    );
    const properties = parseSystemctlShowProperties(stdout);
    return properties.get("UnitFileState") === "enabled" && properties.get("Restart") === "always";
  } catch {
    return false;
  }
}

export async function hasWslCuda(): Promise<boolean> {
  for (const marker of WSL_CUDA_MARKERS) {
    try {
      await access(marker);
      return true;
    } catch {
      // advisory only
    }
  }
  return false;
}

export async function checkWsl2CrashLoopRisk(logger: PluginLogger): Promise<void> {
  if (!isWSL2Sync() || !(await isOllamaEnabledWithRestartAlways()) || !(await hasWslCuda())) {
    return;
  }
  logger.warn(
    [
      "[ollama] WSL2 crash-loop risk: ollama.service is enabled with Restart=always and CUDA is visible.",
      "Disable autostart or reduce Ollama keep-alive before loading GPU-backed models.",
    ].join("\n"),
  );
}
