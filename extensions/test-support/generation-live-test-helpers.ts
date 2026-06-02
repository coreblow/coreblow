import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function shouldLoadEnvForProviders(providerIds: readonly string[]): boolean {
  if (process.env.COREBLOW_LIVE_TEST !== "1" && process.env.LIVE !== "1") {
    return false;
  }
  return providerIds.length > 0;
}

export function maybeLoadShellEnvForGenerationProviders(providerIds: readonly string[]): void {
  if (!shouldLoadEnvForProviders(providerIds)) {
    return;
  }
  const profilePath = path.join(os.homedir(), ".profile");
  if (!fs.existsSync(profilePath)) {
    return;
  }
  try {
    const output = execFileSync(
      "/bin/bash",
      ["-lc", `set -a; source "${profilePath}" >/dev/null 2>&1; env -0`],
      { encoding: "utf8" },
    );
    for (const entry of output.split("\0")) {
      const idx = entry.indexOf("=");
      if (idx <= 0) {
        continue;
      }
      const key = entry.slice(0, idx);
      if (!key || (process.env[key] ?? "") !== "") {
        continue;
      }
      process.env[key] = entry.slice(idx + 1);
    }
  } catch {
    // Live tests should skip or fail on their own provider checks if profile loading fails.
  }
}
