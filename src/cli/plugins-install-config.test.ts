import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";
import type { ConfigFileSnapshot } from "../config/types.coreblow.js";

const loadConfigMock = vi.fn<() => CoreBlowConfig>();
const readConfigFileSnapshotMock = vi.fn<() => Promise<ConfigFileSnapshot>>();
const cleanStaleMatrixPluginConfigMock = vi.fn();

vi.mock("../config/config.js", () => ({
  loadConfig: () => loadConfigMock(),
  readConfigFileSnapshot: () => readConfigFileSnapshotMock(),
}));

vi.mock("../commands/doctor/providers/matrix.js", () => ({
  cleanStaleMatrixPluginConfig: (cfg: CoreBlowConfig) => cleanStaleMatrixPluginConfigMock(cfg),
}));

const { loadConfigForInstall } = await import("./plugins-install-command.js");

function makeSnapshot(overrides: Partial<ConfigFileSnapshot> = {}): ConfigFileSnapshot {
  return {
    path: "/tmp/config.json5",
    exists: true,
    raw: '{ "plugins": {} }',
    parsed: { plugins: {} },
    resolved: { plugins: {} } as CoreBlowConfig,
    valid: false,
    config: { plugins: {} } as CoreBlowConfig,
    hash: "abc",
    issues: [{ path: "plugins.installs.matrix", message: "stale path" }],
    warnings: [],
    legacyIssues: [],
    ...overrides,
  };
}

describe("loadConfigForInstall", () => {
  const matrixNpmRequest = {
    rawSpec: "@coreblow/matrix",
    normalizedSpec: "@coreblow/matrix",
  };

  beforeEach(() => {
    loadConfigMock.mockReset();
    readConfigFileSnapshotMock.mockReset();
    cleanStaleMatrixPluginConfigMock.mockReset();

    cleanStaleMatrixPluginConfigMock.mockImplementation((cfg: CoreBlowConfig) => ({
      config: cfg,
      changes: [],
    }));
  });

  it("returns the config directly when loadConfig succeeds", async () => {
    const cfg = { plugins: { entries: { matrix: { enabled: true } } } } as CoreBlowConfig;
    loadConfigMock.mockReturnValue(cfg);

    const result = await loadConfigForInstall(matrixNpmRequest);
    expect(result).toBe(cfg);
    expect(readConfigFileSnapshotMock).not.toHaveBeenCalled();
  });

  it("does not run stale Matrix cleanup on the happy path", async () => {
    const cfg = { plugins: {} } as CoreBlowConfig;
    loadConfigMock.mockReturnValue(cfg);

    const result = await loadConfigForInstall(matrixNpmRequest);
    expect(cleanStaleMatrixPluginConfigMock).not.toHaveBeenCalled();
    expect(result).toBe(cfg);
  });

  it("falls back to snapshot config for explicit Matrix reinstall when issues match the known upgrade failure", async () => {
    const invalidConfigErr = new Error("config invalid");
    (invalidConfigErr as { code?: string }).code = "INVALID_CONFIG";
    loadConfigMock.mockImplementation(() => {
      throw invalidConfigErr;
    });

    const snapshotCfg = {
      plugins: { installs: { matrix: { source: "path", installPath: "/gone" } } },
    } as unknown as CoreBlowConfig;
    readConfigFileSnapshotMock.mockResolvedValue(
      makeSnapshot({
        parsed: { plugins: { installs: { matrix: {} } } },
        config: snapshotCfg,
        issues: [
          { path: "channels.matrix", message: "unknown channel id: matrix" },
          { path: "plugins.load.paths", message: "plugin: plugin path not found: /gone" },
        ],
      }),
    );

    const result = await loadConfigForInstall(matrixNpmRequest);
    expect(readConfigFileSnapshotMock).toHaveBeenCalled();
    expect(cleanStaleMatrixPluginConfigMock).toHaveBeenCalledWith(snapshotCfg);
    expect(result).toBe(snapshotCfg);
  });

  it("allows explicit repo-checkout Matrix reinstall recovery", async () => {
    const invalidConfigErr = new Error("config invalid");
    (invalidConfigErr as { code?: string }).code = "INVALID_CONFIG";
    loadConfigMock.mockImplementation(() => {
      throw invalidConfigErr;
    });

    const snapshotCfg = { plugins: {} } as CoreBlowConfig;
    readConfigFileSnapshotMock.mockResolvedValue(
      makeSnapshot({
        config: snapshotCfg,
        issues: [{ path: "channels.matrix", message: "unknown channel id: matrix" }],
      }),
    );

    const result = await loadConfigForInstall({
      rawSpec: "./extensions/matrix",
      normalizedSpec: "./extensions/matrix",
      resolvedPath: "/tmp/repo/extensions/matrix",
    });
    expect(result).toBe(snapshotCfg);
  });

  it("rejects unrelated invalid config even during Matrix reinstall", async () => {
    const invalidConfigErr = new Error("config invalid");
    (invalidConfigErr as { code?: string }).code = "INVALID_CONFIG";
    loadConfigMock.mockImplementation(() => {
      throw invalidConfigErr;
    });

    readConfigFileSnapshotMock.mockResolvedValue(
      makeSnapshot({
        issues: [{ path: "models.default", message: "invalid model ref" }],
      }),
    );

    await expect(loadConfigForInstall(matrixNpmRequest)).rejects.toThrow(
      "Config invalid outside the Matrix upgrade recovery path",
    );
  });

  it("rejects non-Matrix install requests when config is invalid", async () => {
    const invalidConfigErr = new Error("config invalid");
    (invalidConfigErr as { code?: string }).code = "INVALID_CONFIG";
    loadConfigMock.mockImplementation(() => {
      throw invalidConfigErr;
    });

    await expect(
      loadConfigForInstall({
        rawSpec: "alpha",
        normalizedSpec: "alpha",
      }),
    ).rejects.toThrow("Config invalid; run `coreblow doctor --fix` before installing plugins.");
    expect(readConfigFileSnapshotMock).not.toHaveBeenCalled();
  });

  it("throws when loadConfig fails with INVALID_CONFIG and snapshot parsed is empty", async () => {
    const invalidConfigErr = new Error("config invalid");
    (invalidConfigErr as { code?: string }).code = "INVALID_CONFIG";
    loadConfigMock.mockImplementation(() => {
      throw invalidConfigErr;
    });

    readConfigFileSnapshotMock.mockResolvedValue(
      makeSnapshot({
        parsed: {},
        config: {} as CoreBlowConfig,
      }),
    );

    await expect(loadConfigForInstall(matrixNpmRequest)).rejects.toThrow(
      "Config file could not be parsed; run `coreblow doctor` to repair it.",
    );
  });

  it("throws when loadConfig fails with INVALID_CONFIG and config file does not exist", async () => {
    const invalidConfigErr = new Error("config invalid");
    (invalidConfigErr as { code?: string }).code = "INVALID_CONFIG";
    loadConfigMock.mockImplementation(() => {
      throw invalidConfigErr;
    });

    readConfigFileSnapshotMock.mockResolvedValue(makeSnapshot({ exists: false, parsed: {} }));

    await expect(loadConfigForInstall(matrixNpmRequest)).rejects.toThrow(
      "Config file could not be parsed; run `coreblow doctor` to repair it.",
    );
  });

  it("re-throws non-config errors from loadConfig", async () => {
    const fsErr = new Error("EACCES: permission denied");
    (fsErr as { code?: string }).code = "EACCES";
    loadConfigMock.mockImplementation(() => {
      throw fsErr;
    });

    await expect(loadConfigForInstall(matrixNpmRequest)).rejects.toThrow(
      "EACCES: permission denied",
    );
    expect(readConfigFileSnapshotMock).not.toHaveBeenCalled();
  });
});
