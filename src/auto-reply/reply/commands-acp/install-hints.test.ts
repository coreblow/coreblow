import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CoreBlowConfig } from "../../../config/config.js";
import { resolveAcpInstallCommandHint, resolveConfiguredAcpBackendId } from "./install-hints.js";

const tempDirs: string[] = [];

function withAcpConfig(acp: CoreBlowConfig["acp"]): CoreBlowConfig {
  return { acp } as CoreBlowConfig;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("ACP install hints", () => {
  it("prefers explicit runtime install command", () => {
    const cfg = withAcpConfig({
      runtime: { installCommand: "pnpm coreblow plugins install acp" },
    });
    expect(resolveAcpInstallCommandHint(cfg)).toBe("pnpm coreblow plugins install acp");
  });

  it("uses local acp extension path when present", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "acp-install-hint-"));
    tempDirs.push(tempRoot);
    fs.mkdirSync(path.join(tempRoot, "extensions", "acp"), { recursive: true });
    vi.spyOn(process, "cwd").mockReturnValue(tempRoot);

    const cfg = withAcpConfig({ backend: "acp" });
    const hint = resolveAcpInstallCommandHint(cfg);
    expect(hint).toContain("coreblow plugins install ");
    expect(hint).toContain(path.join("extensions", "acp"));
  });

  it("falls back to scoped install hint for acp when local extension is absent", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "acp-install-hint-"));
    tempDirs.push(tempRoot);
    vi.spyOn(process, "cwd").mockReturnValue(tempRoot);

    const cfg = withAcpConfig({ backend: "acp" });
    expect(resolveAcpInstallCommandHint(cfg)).toBe("coreblow plugins install acp");
  });

  it("returns generic plugin hint for non-acp backend", () => {
    const cfg = withAcpConfig({ backend: "custom-backend" });
    expect(resolveConfiguredAcpBackendId(cfg)).toBe("custom-backend");
    expect(resolveAcpInstallCommandHint(cfg)).toContain('ACP backend "custom-backend"');
  });
});
