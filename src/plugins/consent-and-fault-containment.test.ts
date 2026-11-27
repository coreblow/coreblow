import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearPluginLoaderCache,
  containPluginExecution,
  isThirdPartyPluginConsented,
  loadCoreBlowPlugins,
} from "./loader.js";

describe("Plugin Third-Party Consent & Fault Containment", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    clearPluginLoaderCache();
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  function createThirdPartyPluginFixture(
    id: string,
    indexJsBody: string,
  ): { rootDir: string; entryPath: string } {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-plugin-fault-"));
    tempDirs.push(tmp);
    const pluginDir = path.join(tmp, id);
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(
      path.join(pluginDir, "coreblow.plugin.json"),
      JSON.stringify({
        id,
        name: id,
        version: "1.0.0",
        configSchema: { type: "object", properties: {} },
      }),
      "utf8",
    );
    const entryPath = path.join(pluginDir, "index.js");
    fs.writeFileSync(entryPath, indexJsBody, "utf8");
    return { rootDir: tmp, entryPath };
  }

  it("enforces consent for non-bundled plugins while always allowing bundled extensions", () => {
    expect(
      isThirdPartyPluginConsented({
        pluginId: "telegram",
        origin: "bundled",
        requireThirdPartyConsent: true,
        consentedPluginIds: [],
      }),
    ).toBe(true);

    expect(
      isThirdPartyPluginConsented({
        pluginId: "untrusted-ext",
        origin: "global",
        requireThirdPartyConsent: true,
        consentedPluginIds: ["other-ext"],
      }),
    ).toBe(false);

    expect(
      isThirdPartyPluginConsented({
        pluginId: "trusted-ext",
        origin: "workspace",
        requireThirdPartyConsent: true,
        consentedPluginIds: ["trusted-ext"],
      }),
    ).toBe(true);
  });

  it("contains both sync throws and async rejections via containPluginExecution", async () => {
    const errors: unknown[] = [];
    const syncRes = await containPluginExecution({
      pluginId: "sync-bomb",
      fn: () => {
        throw new Error("sync boom");
      },
      onError: (err) => errors.push(err),
    });
    expect(syncRes.ok).toBe(false);

    const asyncRes = await containPluginExecution({
      pluginId: "async-bomb",
      fn: async () => {
        throw new Error("async boom");
      },
      onError: (err) => errors.push(err),
    });
    expect(asyncRes.ok).toBe(false);
    expect(errors).toHaveLength(2);
  });

  it("blocks unconsented third-party plugin load when requireThirdPartyConsent is true", () => {
    const { entryPath } = createThirdPartyPluginFixture(
      "third-party-unconsented",
      `module.exports = { id: "third-party-unconsented", register() { throw new Error("should not execute"); } };`,
    );

    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    const registry = loadCoreBlowPlugins({
      cache: false,
      logger,
      requireThirdPartyConsent: true,
      consentedPluginIds: [],
      onlyPluginIds: ["third-party-unconsented"],
      config: {
        plugins: {
          load: { paths: [entryPath] },
          entries: { "third-party-unconsented": { enabled: true } },
        },
      },
    });

    const loaded = registry.plugins.find((p) => p.id === "third-party-unconsented");
    expect(loaded).toBeDefined();
    expect(loaded?.status).toBe("error");
    expect(loaded?.error).toContain("explicit operator consent");
  });

  it("contains sync throws and async rejections from consented plugins without crashing Gateway", async () => {
    const { entryPath: syncEntry } = createThirdPartyPluginFixture(
      "third-party-sync-crash",
      `module.exports = { id: "third-party-sync-crash", register() { throw new Error("sync register crash"); } };`,
    );
    const { entryPath: asyncEntry } = createThirdPartyPluginFixture(
      "third-party-async-crash",
      `module.exports = { id: "third-party-async-crash", register() { return Promise.reject(new Error("async register crash")); } };`,
    );

    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);

    try {
      const logger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };

      const registry = loadCoreBlowPlugins({
        cache: false,
        logger,
        requireThirdPartyConsent: true,
        consentedPluginIds: ["third-party-sync-crash", "third-party-async-crash"],
        onlyPluginIds: ["third-party-sync-crash", "third-party-async-crash"],
        config: {
          plugins: {
            load: { paths: [syncEntry, asyncEntry] },
            entries: {
              "third-party-sync-crash": { enabled: true },
              "third-party-async-crash": { enabled: true },
            },
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 25));

      const syncRec = registry.plugins.find((p) => p.id === "third-party-sync-crash");
      const asyncRec = registry.plugins.find((p) => p.id === "third-party-async-crash");
      expect(syncRec?.status).toBe("error");
      expect(syncRec?.error).toContain("sync register crash");
      expect(asyncRec?.status).toBe("error");
      expect(asyncRec?.error).toContain("async register crash");
      expect(unhandled).toHaveLength(0);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
});
