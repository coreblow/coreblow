import { describe, expect, it, vi } from "vitest";

const installPluginFromCoreHubMock = vi.fn();
const verifyCoreHubInstalledTrustRecordMock = vi.fn();

vi.mock("./coreblow-hub.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./coreblow-hub.js")>();
  return {
    ...actual,
    installPluginFromCoreHub: (...args: unknown[]) => installPluginFromCoreHubMock(...args),
    verifyCoreHubInstalledTrustRecord: (...args: unknown[]) =>
      verifyCoreHubInstalledTrustRecordMock(...args),
  };
});

const {
  CLAWHUB_INSTALL_ERROR_CODE,
  formatClawHubSpecifier,
  installPluginFromClawHub,
  verifyClawHubInstalledTrustRecord,
} = await import("./clawhub.js");
const { COREHUB_INSTALL_ERROR_CODE } = await import("./coreblow-hub.js");

describe("ClawHub plugin compatibility facade", () => {
  it("formats legacy ClawHub helper output as the CoreHub public spec", () => {
    expect(formatClawHubSpecifier({ name: "demo" })).toBe("corehub:demo");
    expect(formatClawHubSpecifier({ name: "demo", version: "1.2.3" })).toBe(
      "corehub:demo@1.2.3",
    );
  });

  it("re-exports CoreHub install error codes for legacy imports", () => {
    expect(CLAWHUB_INSTALL_ERROR_CODE).toBe(COREHUB_INSTALL_ERROR_CODE);
    expect(CLAWHUB_INSTALL_ERROR_CODE.PACKAGE_NOT_FOUND).toBe("package_not_found");
  });

  it("normalizes clawhub specs before delegating install to CoreHub", async () => {
    installPluginFromCoreHubMock.mockResolvedValueOnce({
      ok: true,
      pluginId: "demo",
      version: "1.2.3",
      corehub: {
        source: "corehub",
        corehubPackage: "demo",
      },
    });

    await expect(
      installPluginFromClawHub({
        spec: "clawhub:demo@1.2.3",
        baseUrl: "https://coreblow.com/corehub",
        mode: "install",
      }),
    ).resolves.toMatchObject({
      ok: true,
      corehub: {
        source: "corehub",
        corehubPackage: "demo",
      },
    });

    expect(installPluginFromCoreHubMock).toHaveBeenCalledWith({
      spec: "corehub:demo@1.2.3",
      baseUrl: "https://coreblow.com/corehub",
      mode: "install",
    });
  });

  it("passes through corehub specs without rewriting", async () => {
    installPluginFromCoreHubMock.mockResolvedValueOnce({
      ok: false,
      error: "Package not found on CoreHub.",
      code: COREHUB_INSTALL_ERROR_CODE.PACKAGE_NOT_FOUND,
    });

    await installPluginFromClawHub({ spec: "corehub:missing" });

    expect(installPluginFromCoreHubMock).toHaveBeenCalledWith({
      spec: "corehub:missing",
    });
  });

  it("delegates legacy trust verification imports to CoreHub", async () => {
    verifyCoreHubInstalledTrustRecordMock.mockResolvedValueOnce({
      ok: true,
      warnings: [],
    });

    await expect(
      verifyClawHubInstalledTrustRecord({
        record: {
          corehubPackage: "demo",
          version: "1.2.3",
        },
      }),
    ).resolves.toEqual({ ok: true, warnings: [] });

    expect(verifyCoreHubInstalledTrustRecordMock).toHaveBeenCalledWith({
      record: {
        corehubPackage: "demo",
        version: "1.2.3",
      },
    });
  });
});
