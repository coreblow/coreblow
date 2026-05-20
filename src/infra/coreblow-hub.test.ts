import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  downloadCoreHubPackageArchive,
  fetchCoreHubPackageDetail,
  fetchCoreHubPackageVersion,
  formatSha256Integrity,
  parseCoreHubPluginSpec,
  resolveCoreHubAuthToken,
  searchCoreHubSkills,
  resolveLatestVersionFromPackage,
  satisfiesGatewayMinimum,
  satisfiesPluginApiRange,
} from "./coreblow-hub.js";

function createTarGzArchive(files: Record<string, string | Uint8Array>): Buffer {
  const chunks: Buffer[] = [];
  for (const [filePath, contents] of Object.entries(files).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const bytes = Buffer.from(contents);
    const header = Buffer.alloc(512, 0);
    header.write(filePath, 0, 100, "utf8");
    writeTarOctal(header, 0o644, 100, 8);
    writeTarOctal(header, 0, 108, 8);
    writeTarOctal(header, 0, 116, 8);
    writeTarOctal(header, bytes.byteLength, 124, 12);
    writeTarOctal(header, 0, 136, 12);
    header.fill(0x20, 148, 156);
    header[156] = "0".charCodeAt(0);
    header.write("ustar", 257, 6, "ascii");
    header.write("00", 263, 2, "ascii");
    writeTarOctal(
      header,
      header.reduce((total, byte) => total + byte, 0),
      148,
      8,
    );
    chunks.push(header, bytes, Buffer.alloc((512 - (bytes.byteLength % 512)) % 512, 0));
  }
  chunks.push(Buffer.alloc(1024, 0));
  return gzipSync(Buffer.concat(chunks));
}

function writeTarOctal(buffer: Buffer, value: number, offset: number, length: number) {
  buffer.write(`${value.toString(8).padStart(length - 1, "0")}\0`, offset, length, "ascii");
}

function sha256Hex(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function responseBody(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe("corehub helpers", () => {
  const originalHome = process.env.HOME;

  afterEach(() => {
    delete process.env.COREBLOW_COREHUB_TOKEN;
    delete process.env.COREHUB_TOKEN;
    delete process.env.COREHUB_AUTH_TOKEN;
    delete process.env.COREBLOW_COREHUB_CONFIG_PATH;
    delete process.env.COREHUB_CONFIG_PATH;
    delete process.env.XDG_CONFIG_HOME;
    if (originalHome == null) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
  });

  it("parses explicit CoreHub package specs", () => {
    expect(parseCoreHubPluginSpec("corehub:demo")).toEqual({
      name: "demo",
    });
    expect(parseCoreHubPluginSpec("corehub:demo@1.2.3")).toEqual({
      name: "demo",
      version: "1.2.3",
    });
    expect(parseCoreHubPluginSpec("@scope/pkg")).toBeNull();
  });

  it("resolves latest versions from latestVersion before tags", () => {
    expect(
      resolveLatestVersionFromPackage({
        package: {
          name: "demo",
          displayName: "Demo",
          family: "code-plugin",
          channel: "official",
          isOfficial: true,
          createdAt: 0,
          updatedAt: 0,
          latestVersion: "1.2.3",
          tags: { latest: "1.2.2" },
        },
      }),
    ).toBe("1.2.3");
    expect(
      resolveLatestVersionFromPackage({
        package: {
          name: "demo",
          displayName: "Demo",
          family: "code-plugin",
          channel: "official",
          isOfficial: true,
          createdAt: 0,
          updatedAt: 0,
          tags: { latest: "1.2.2" },
        },
      }),
    ).toBe("1.2.2");
  });

  it("checks plugin api ranges without semver dependency", () => {
    expect(satisfiesPluginApiRange("1.2.3", "^1.2.0")).toBe(true);
    expect(satisfiesPluginApiRange("1.9.0", ">=1.2.0 <2.0.0")).toBe(true);
    expect(satisfiesPluginApiRange("2.0.0", "^1.2.0")).toBe(false);
    expect(satisfiesPluginApiRange("1.1.9", ">=1.2.0")).toBe(false);
    expect(satisfiesPluginApiRange("2026.3.22", ">=2026.3.22")).toBe(true);
    expect(satisfiesPluginApiRange("2026.3.21", ">=2026.3.22")).toBe(false);
    expect(satisfiesPluginApiRange("invalid", "^1.2.0")).toBe(false);
  });

  it("checks min gateway versions with loose host labels", () => {
    expect(satisfiesGatewayMinimum("2026.3.22", "2026.3.0")).toBe(true);
    expect(satisfiesGatewayMinimum("CoreBlow 2026.3.22", "2026.3.0")).toBe(true);
    expect(satisfiesGatewayMinimum("2026.2.9", "2026.3.0")).toBe(false);
    expect(satisfiesGatewayMinimum("unknown", "2026.3.0")).toBe(false);
  });

  it("resolves CoreHub auth token from config.json", async () => {
    const configRoot = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-corehub-config-"));
    const configPath = path.join(configRoot, "corehub", "config.json");
    process.env.COREBLOW_COREHUB_CONFIG_PATH = configPath;
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify({ auth: { token: "cfg-token-123" } }), "utf8");

    await expect(resolveCoreHubAuthToken()).resolves.toBe("cfg-token-123");
  });

  it.runIf(process.platform === "darwin")(
    "resolves CoreHub auth token from the macOS Application Support path",
    async () => {
      const fakeHome = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-corehub-home-"));
      const configPath = path.join(
        fakeHome,
        "Library",
        "Application Support",
        "corehub",
        "config.json",
      );
      const homedirSpy = vi.spyOn(os, "homedir").mockReturnValue(fakeHome);
      try {
        await fs.mkdir(path.dirname(configPath), { recursive: true });
        await fs.writeFile(configPath, JSON.stringify({ token: "macos-token-123" }), "utf8");

        await expect(resolveCoreHubAuthToken()).resolves.toBe("macos-token-123");
      } finally {
        homedirSpy.mockRestore();
      }
    },
  );

  it.runIf(process.platform === "darwin")(
    "falls back to XDG_CONFIG_HOME on macOS when Application Support has no config",
    async () => {
      const fakeHome = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-corehub-home-"));
      const xdgRoot = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-corehub-xdg-"));
      const configPath = path.join(xdgRoot, "corehub", "config.json");
      const homedirSpy = vi.spyOn(os, "homedir").mockReturnValue(fakeHome);
      process.env.XDG_CONFIG_HOME = xdgRoot;
      try {
        await fs.mkdir(path.dirname(configPath), { recursive: true });
        await fs.writeFile(configPath, JSON.stringify({ token: "xdg-token-123" }), "utf8");

        await expect(resolveCoreHubAuthToken()).resolves.toBe("xdg-token-123");
      } finally {
        homedirSpy.mockRestore();
      }
    },
  );

  it("injects resolved auth token into CoreHub requests", async () => {
    process.env.COREBLOW_COREHUB_TOKEN = "env-token-123";
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      expect(url).toContain("/api/v1/search");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer env-token-123");
      return new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    await expect(searchCoreHubSkills({ query: "calendar", fetchImpl })).resolves.toEqual([]);
  });

  it("maps CoreHub Registry API entry envelopes into package detail", async () => {
    const fetchImpl = async (input: string | URL | Request) => {
      expect(String(input)).toBe("https://coreblow.com/corehub/api/v1/packages/plugin-lab");
      return new Response(
        JSON.stringify({
          apiVersion: "v1",
          data: {
            id: "plugin-lab",
            kind: "plugin",
            name: "Plugin Lab",
            summary: "Compatibility lab",
            source: "https://github.com/coreblow/plugin-lab",
            publisher: {
              handle: "coreblow",
              displayName: "CoreBlow",
              verified: true,
            },
            review: {
              state: "verified",
            },
            coreblow: {
              minCoreblowVersion: "1.0.0",
            },
            versions: [{ version: "0.1.0", tag: "latest" }],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    await expect(fetchCoreHubPackageDetail({ name: "plugin-lab", fetchImpl })).resolves.toMatchObject({
      package: {
        name: "plugin-lab",
        displayName: "Plugin Lab",
        family: "code-plugin",
        channel: "official",
        latestVersion: "0.1.0",
        compatibility: {
          minGatewayVersion: "1.0.0",
        },
      },
      owner: {
        handle: "coreblow",
      },
    });
  });

  it("selects versions from CoreHub Registry API version lists", async () => {
    const fetchImpl = async (input: string | URL | Request) => {
      expect(String(input)).toBe("https://coreblow.com/corehub/api/v1/packages/plugin-lab/versions");
      return new Response(
        JSON.stringify({
          apiVersion: "v1",
          data: [
            { version: "0.1.0", tag: "latest", publishedAt: "2026-05-20" },
            { version: "0.0.1", publishedAt: "2026-05-19" },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    await expect(
      fetchCoreHubPackageVersion({ name: "plugin-lab", version: "0.1.0", fetchImpl }),
    ).resolves.toMatchObject({
      version: {
        version: "0.1.0",
        distTags: ["latest"],
      },
    });
  });

  it("downloads CoreHub package archives through signed metadata and verifies checksum", async () => {
    const archiveBytes = new TextEncoder().encode("plugin archive bytes");
    const expectedSha256 = createHash("sha256").update(archiveBytes).digest("hex");
    const fetchImpl = async (input: string | URL | Request) => {
      const url = String(input);
      if (url.startsWith("https://coreblow.com/corehub/api/v1/packages/plugin-lab/download")) {
        expect(url).toContain("redirect=false");
        return new Response(
          JSON.stringify({
            apiVersion: "v1",
            data: {
              artifact: {
                name: "plugin-lab-0.1.0.coreblow-plugin.tgz",
                size: archiveBytes.byteLength,
                sha256: expectedSha256,
              },
              download: {
                available: true,
                url: "https://storage.example/plugin-lab-0.1.0.coreblow-plugin.tgz",
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      expect(url).toBe("https://storage.example/plugin-lab-0.1.0.coreblow-plugin.tgz");
      return new Response(responseBody(archiveBytes), { status: 200 });
    };

    const result = await downloadCoreHubPackageArchive({
      name: "plugin-lab",
      version: "0.1.0",
      fetchImpl,
    });
    try {
      await expect(fs.readFile(result.archivePath)).resolves.toEqual(Buffer.from(archiveBytes));
      expect(path.basename(result.archivePath)).toBe("plugin-lab-0.1.0.coreblow-plugin.tgz");
      expect(result.integrity).toBe(formatSha256Integrity(archiveBytes));
    } finally {
      await fs.rm(path.dirname(result.archivePath), { recursive: true, force: true });
    }
  });

  it("verifies the internal CoreHub artifact manifest when catalog metadata declares it", async () => {
    const archiveFiles = {
      "coreblow.plugin.json": JSON.stringify({
        id: "plugin-lab",
        configSchema: { type: "object", additionalProperties: false },
      }),
      "corehub.artifact.json": JSON.stringify({
        schemaVersion: "corehub.plugin-artifact.v1",
        package: { id: "plugin-lab", version: "0.1.0", kind: "plugin" },
        publisher: { handle: "coreblow" },
        install: {
          packageManifest: "package.json",
          pluginManifest: "coreblow.plugin.json",
          entry: "index.js",
        },
      }),
      "index.js": "export function activate() { return { tools: [], hooks: [] }; }\n",
      "package.json": JSON.stringify({
        name: "plugin-lab",
        version: "0.1.0",
        type: "module",
        coreblow: { extensions: ["./index.js"], install: { minHostVersion: ">=1.0.0" } },
      }),
    };
    const archiveBytes = createTarGzArchive(archiveFiles);
    const files = Object.entries(archiveFiles).map(([filePath, contents]) => {
      const bytes = Buffer.from(contents);
      return { path: filePath, size: bytes.byteLength, sha256: sha256Hex(bytes) };
    });
    const fetchImpl = async (input: string | URL | Request) => {
      const url = String(input);
      if (url.startsWith("https://coreblow.com/corehub/api/v1/packages/plugin-lab/download")) {
        return new Response(
          JSON.stringify({
            apiVersion: "v1",
            data: {
              package: { id: "plugin-lab", name: "plugin-lab" },
              version: "0.1.0",
              artifact: {
                name: "plugin-lab-0.1.0.coreblow-plugin.tgz",
                size: archiveBytes.byteLength,
                sha256: sha256Hex(archiveBytes),
                files,
              },
              download: {
                available: true,
                url: "https://storage.example/plugin-lab-0.1.0.coreblow-plugin.tgz",
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(responseBody(archiveBytes), { status: 200 });
    };

    const result = await downloadCoreHubPackageArchive({
      name: "plugin-lab",
      version: "0.1.0",
      fetchImpl,
    });
    try {
      await expect(fs.readFile(result.archivePath)).resolves.toEqual(Buffer.from(archiveBytes));
    } finally {
      await fs.rm(path.dirname(result.archivePath), { recursive: true, force: true });
    }
  });

  it("rejects CoreHub artifacts when the internal manifest disagrees with registry metadata", async () => {
    const archiveBytes = createTarGzArchive({
      "corehub.artifact.json": JSON.stringify({
        schemaVersion: "corehub.plugin-artifact.v1",
        package: { id: "other-plugin", version: "0.1.0", kind: "plugin" },
      }),
    });
    const manifestBytes = Buffer.from(
      JSON.stringify({
        schemaVersion: "corehub.plugin-artifact.v1",
        package: { id: "other-plugin", version: "0.1.0", kind: "plugin" },
      }),
    );
    const fetchImpl = async (input: string | URL | Request) => {
      const url = String(input);
      if (url.startsWith("https://coreblow.com/corehub/api/v1/packages/plugin-lab/download")) {
        return new Response(
          JSON.stringify({
            apiVersion: "v1",
            data: {
              package: { id: "plugin-lab", name: "plugin-lab" },
              version: "0.1.0",
              artifact: {
                name: "plugin-lab-0.1.0.coreblow-plugin.tgz",
                size: archiveBytes.byteLength,
                sha256: sha256Hex(archiveBytes),
                files: [
                  {
                    path: "corehub.artifact.json",
                    size: manifestBytes.byteLength,
                    sha256: sha256Hex(manifestBytes),
                  },
                ],
              },
              download: {
                available: true,
                url: "https://storage.example/plugin-lab-0.1.0.coreblow-plugin.tgz",
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(responseBody(archiveBytes), { status: 200 });
    };

    await expect(
      downloadCoreHubPackageArchive({
        name: "plugin-lab",
        version: "0.1.0",
        fetchImpl,
      }),
    ).rejects.toThrow(
      "CoreHub artifact manifest package id mismatch: expected plugin-lab, received other-plugin",
    );
  });
});
