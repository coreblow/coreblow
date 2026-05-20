import { beforeEach, describe, expect, it, vi } from "vitest";

const parseCoreHubPluginSpecMock = vi.fn();
const fetchCoreHubPackageDetailMock = vi.fn();
const fetchCoreHubPackageVersionMock = vi.fn();
const downloadCoreHubPackageArchiveMock = vi.fn();
const resolveLatestVersionFromPackageMock = vi.fn();
const resolveCompatibilityHostVersionMock = vi.fn();
const installPluginFromArchiveMock = vi.fn();

vi.mock("../infra/coreblow-hub.js", async () => {
  const actual = await vi.importActual<typeof import("../infra/coreblow-hub.js")>("../infra/coreblow-hub.js");
  return {
    ...actual,
    parseCoreHubPluginSpec: (...args: unknown[]) => parseCoreHubPluginSpecMock(...args),
    fetchCoreHubPackageDetail: (...args: unknown[]) => fetchCoreHubPackageDetailMock(...args),
    fetchCoreHubPackageVersion: (...args: unknown[]) => fetchCoreHubPackageVersionMock(...args),
    downloadCoreHubPackageArchive: (...args: unknown[]) =>
      downloadCoreHubPackageArchiveMock(...args),
    resolveLatestVersionFromPackage: (...args: unknown[]) =>
      resolveLatestVersionFromPackageMock(...args),
  };
});

vi.mock("../version.js", () => ({
  resolveCompatibilityHostVersion: (...args: unknown[]) =>
    resolveCompatibilityHostVersionMock(...args),
}));

vi.mock("./install.js", () => ({
  installPluginFromArchive: (...args: unknown[]) => installPluginFromArchiveMock(...args),
}));

const { CoreHubRequestError } = await import("../infra/coreblow-hub.js");
const {
  COREHUB_INSTALL_ERROR_CODE,
  formatCoreHubSpecifier,
  installPluginFromCoreHub,
  verifyCoreHubInstalledTrustRecord,
} = await import("./coreblow-hub.js");

async function expectCoreHubInstallError(params: {
  setup?: () => void;
  spec: string;
  expected: {
    ok: false;
    code: (typeof COREHUB_INSTALL_ERROR_CODE)[keyof typeof COREHUB_INSTALL_ERROR_CODE];
    error: string;
  };
}) {
  params.setup?.();
  await expect(installPluginFromCoreHub({ spec: params.spec })).resolves.toMatchObject(
    params.expected,
  );
}

function createLoggerSpies() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
  };
}

function expectCoreHubInstallFlow(params: {
  baseUrl: string;
  version: string;
  archivePath: string;
}) {
  expect(fetchCoreHubPackageDetailMock).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "demo",
      baseUrl: params.baseUrl,
    }),
  );
  expect(fetchCoreHubPackageVersionMock).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "demo",
      version: params.version,
    }),
  );
  expect(installPluginFromArchiveMock).toHaveBeenCalledWith(
    expect.objectContaining({
      archivePath: params.archivePath,
    }),
  );
}

function expectSuccessfulCoreHubInstall(result: unknown) {
  expect(result).toMatchObject({
    ok: true,
    pluginId: "demo",
    version: "2026.3.22",
    corehub: {
      source: "corehub",
      corehubPackage: "demo",
      corehubFamily: "code-plugin",
      corehubChannel: "official",
      integrity: "sha256-demo",
      artifactSha256: "demo-sha256",
      artifactSize: 1234,
      artifactManifestVerified: true,
      artifactManifestSha256: "demo-manifest-sha256",
      artifactStorageKey: "plugins/demo/archive.zip",
      publisherHandle: "coreblow",
    },
  });
}

describe("installPluginFromCoreHub", () => {
  beforeEach(() => {
    parseCoreHubPluginSpecMock.mockReset();
    fetchCoreHubPackageDetailMock.mockReset();
    fetchCoreHubPackageVersionMock.mockReset();
    downloadCoreHubPackageArchiveMock.mockReset();
    resolveLatestVersionFromPackageMock.mockReset();
    resolveCompatibilityHostVersionMock.mockReset();
    installPluginFromArchiveMock.mockReset();

    parseCoreHubPluginSpecMock.mockReturnValue({ name: "demo" });
    fetchCoreHubPackageDetailMock.mockResolvedValue({
      package: {
        name: "demo",
        displayName: "Demo",
        family: "code-plugin",
        channel: "official",
        isOfficial: true,
        createdAt: 0,
        updatedAt: 0,
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    resolveLatestVersionFromPackageMock.mockReturnValue("2026.3.22");
    fetchCoreHubPackageVersionMock.mockResolvedValue({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadCoreHubPackageArchiveMock.mockResolvedValue({
      archivePath: "/tmp/corehub-demo/archive.zip",
      integrity: "sha256-demo",
      artifactSha256: "demo-sha256",
      artifactSize: 1234,
      artifactManifestVerified: true,
      artifactManifestSha256: "demo-manifest-sha256",
      artifactStorageKey: "plugins/demo/archive.zip",
      publisherHandle: "coreblow",
    });
    resolveCompatibilityHostVersionMock.mockReturnValue("2026.3.22");
    installPluginFromArchiveMock.mockResolvedValue({
      ok: true,
      pluginId: "demo",
      targetDir: "/tmp/coreblow/plugins/demo",
      version: "2026.3.22",
    });
  });

  it("formats corehub specifiers", () => {
    expect(formatCoreHubSpecifier({ name: "demo" })).toBe("corehub:demo");
    expect(formatCoreHubSpecifier({ name: "demo", version: "1.2.3" })).toBe("corehub:demo@1.2.3");
  });

  it("installs a CoreHub code plugin through the archive installer", async () => {
    const logger = createLoggerSpies();
    const result = await installPluginFromCoreHub({
      spec: "corehub:demo",
      baseUrl: "https://corehub.ai",
      logger,
    });

    expectCoreHubInstallFlow({
      baseUrl: "https://corehub.ai",
      version: "2026.3.22",
      archivePath: "/tmp/corehub-demo/archive.zip",
    });
    expectSuccessfulCoreHubInstall(result);
    expect(logger.info).toHaveBeenCalledWith("CoreHub code-plugin demo@2026.3.22 channel=official");
    expect(logger.info).toHaveBeenCalledWith(
      "Compatibility: pluginApi=>=2026.3.22 minGateway=2026.3.0",
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("blocks install when CoreHub marks the target version blocked", async () => {
    fetchCoreHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        status: "blocked",
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });

    await expect(installPluginFromCoreHub({ spec: "corehub:demo" })).resolves.toMatchObject({
      ok: false,
      code: COREHUB_INSTALL_ERROR_CODE.MODERATION_BLOCKED,
      error:
        'CoreHub package "demo" version 2026.3.22 is blocked and cannot be installed or updated.',
    });
    expect(downloadCoreHubPackageArchiveMock).not.toHaveBeenCalled();
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
  });

  it("warns but allows install when CoreHub marks the target version deprecated", async () => {
    const logger = createLoggerSpies();
    fetchCoreHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        status: "deprecated",
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });

    const result = await installPluginFromCoreHub({
      spec: "corehub:demo",
      logger,
    });

    expectSuccessfulCoreHubInstall(result);
    expect(logger.warn).toHaveBeenCalledWith(
      'CoreHub package "demo" version 2026.3.22 is deprecated; install is allowed, but update soon.',
    );
  });

  it("detects stored CoreHub trust proof drift before update", async () => {
    fetchCoreHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        status: "available",
        publisher: { handle: "coreblow" },
        artifact: {
          sha256: "changed-sha256",
          size: 1234,
          files: [{ path: "corehub.artifact.json", sha256: "demo-manifest-sha256" }],
          storage: { key: "plugins/demo/archive.zip" },
        },
      },
    });

    await expect(
      verifyCoreHubInstalledTrustRecord({
        record: {
          corehubUrl: "https://corehub.ai",
          corehubPackage: "demo",
          version: "2026.3.22",
          artifactSha256: "demo-sha256",
          artifactSize: 1234,
          artifactManifestVerified: true,
          artifactManifestSha256: "demo-manifest-sha256",
          artifactStorageKey: "plugins/demo/archive.zip",
          publisherHandle: "coreblow",
        },
      }),
    ).resolves.toMatchObject({
      ok: false,
      code: COREHUB_INSTALL_ERROR_CODE.TRUST_DRIFT,
      error: expect.stringContaining("artifactSha256 changed"),
    });
  });

  it.each([
    {
      name: "rejects packages whose plugin API range exceeds the runtime version",
      setup: () => {
        resolveCompatibilityHostVersionMock.mockReturnValueOnce("2026.3.21");
      },
      spec: "corehub:demo",
      expected: {
        ok: false,
        code: COREHUB_INSTALL_ERROR_CODE.INCOMPATIBLE_PLUGIN_API,
        error:
          'Plugin "demo" requires plugin API >=2026.3.22, but this CoreBlow runtime exposes 2026.3.21.',
      },
    },
    {
      name: "rejects skill families and redirects to skills install",
      setup: () => {
        fetchCoreHubPackageDetailMock.mockResolvedValueOnce({
          package: {
            name: "calendar",
            displayName: "Calendar",
            family: "skill",
            channel: "official",
            isOfficial: true,
            createdAt: 0,
            updatedAt: 0,
          },
        });
      },
      spec: "corehub:calendar",
      expected: {
        ok: false,
        code: COREHUB_INSTALL_ERROR_CODE.SKILL_PACKAGE,
        error: '"calendar" is a skill. Use "coreblow skills install calendar" instead.',
      },
    },
    {
      name: "returns typed package-not-found failures",
      setup: () => {
        fetchCoreHubPackageDetailMock.mockRejectedValueOnce(
          new CoreHubRequestError({
            path: "/api/v1/packages/demo",
            status: 404,
            body: "Package not found",
          }),
        );
      },
      spec: "corehub:demo",
      expected: {
        ok: false,
        code: COREHUB_INSTALL_ERROR_CODE.PACKAGE_NOT_FOUND,
        error: "Package not found on CoreHub.",
      },
    },
    {
      name: "returns typed version-not-found failures",
      setup: () => {
        parseCoreHubPluginSpecMock.mockReturnValueOnce({ name: "demo", version: "9.9.9" });
        fetchCoreHubPackageVersionMock.mockRejectedValueOnce(
          new CoreHubRequestError({
            path: "/api/v1/packages/demo/versions/9.9.9",
            status: 404,
            body: "Version not found",
          }),
        );
      },
      spec: "corehub:demo@9.9.9",
      expected: {
        ok: false,
        code: COREHUB_INSTALL_ERROR_CODE.VERSION_NOT_FOUND,
        error: "Version not found on CoreHub: demo@9.9.9.",
      },
    },
  ] as const)("$name", async ({ setup, spec, expected }) => {
    await expectCoreHubInstallError({ setup, spec, expected });
  });
});
