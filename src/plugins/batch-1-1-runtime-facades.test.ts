import { describe, expect, it } from "vitest";
import {
  findBundledPackageChannelMetadata,
  listBundledPackageChannelMetadata,
} from "./bundled-package-channel-metadata.js";
import {
  encodePluginInstallDirName,
  matchesExpectedPluginId,
  resolveDefaultPluginExtensionsDir,
  resolveDefaultPluginGitDir,
  resolveDefaultPluginNpmDir,
  safePluginInstallFileName,
  validatePluginId,
} from "./install-paths.js";
import {
  LEGACY_NPM_DECLARATION_FALLBACK_FILE,
  LEGACY_NPM_DECLARATION_FILE,
  readLegacyNpmPluginDeclaration,
} from "./legacy-npm-declaration.js";
import {
  assertUniqueValues,
  BUNDLED_RUNTIME_SIDECAR_PATHS,
} from "./runtime-sidecar-paths.js";
import { createPluginSourceLoader } from "./source-loader.js";
import { resolveRuntimeTextTransforms } from "./text-transforms.runtime.ts";
import { resolvePluginWebContentExtractors } from "./web-content-extractors.runtime.js";
import {
  resolveBundledWebFetchResolutionConfig,
  sortWebFetchProviders,
  sortWebFetchProvidersForAutoDetect,
} from "./web-fetch-providers.shared.js";

describe("Batch 1.1 - Runtime Facades & Lightweight Extractors", () => {
  describe("runtime-sidecar-paths", () => {
    it("asserts unique values and throws on duplicates", () => {
      expect(assertUniqueValues(["a", "b", "c"], "test")).toEqual(["a", "b", "c"]);
      expect(() => assertUniqueValues(["a", "b", "a"], "test")).toThrow(
        "Duplicate test: a",
      );
    });

    it("exports BUNDLED_RUNTIME_SIDECAR_PATHS array", () => {
      expect(Array.isArray(BUNDLED_RUNTIME_SIDECAR_PATHS)).toBe(true);
      expect(BUNDLED_RUNTIME_SIDECAR_PATHS.length).toBeGreaterThan(0);
    });
  });

  describe("install-paths", () => {
    it("validates valid and invalid plugin IDs", () => {
      expect(validatePluginId("valid-plugin")).toBeNull();
      expect(validatePluginId("@scope/valid-plugin")).toBeNull();
      expect(validatePluginId("")).toBe("invalid plugin name: missing");
      expect(validatePluginId("path/with/too/many/slashes")).toBe(
        "invalid plugin name: path separators not allowed",
      );
      expect(validatePluginId("@invalid-scope-only")).toBe(
        "invalid plugin name: scoped ids must use @scope/name format",
      );
      expect(validatePluginId("invalid\\backslash")).toBe(
        "invalid plugin name: path separators not allowed",
      );
    });

    it("encodes plugin directory names", () => {
      expect(encodePluginInstallDirName("simple-plugin")).toBe("simple-plugin");
      expect(encodePluginInstallDirName("@scope/plugin")).toMatch(/^@/);
    });

    it("sanitizes install filenames", () => {
      expect(safePluginInstallFileName("my-plugin")).toBe("my-plugin");
    });

    it("matches expected plugin id with backward compatibility", () => {
      expect(
        matchesExpectedPluginId({
          expectedPluginId: "test-plugin",
          pluginId: "test-plugin",
          npmPluginId: "test-plugin",
        }),
      ).toBe(true);

      expect(
        matchesExpectedPluginId({
          expectedPluginId: "other",
          pluginId: "test-plugin",
          npmPluginId: "test-plugin",
        }),
      ).toBe(false);
    });

    it("resolves default directory paths", () => {
      expect(resolveDefaultPluginExtensionsDir()).toContain("extensions");
      expect(resolveDefaultPluginNpmDir()).toContain("npm");
      expect(resolveDefaultPluginGitDir()).toContain("git");
    });
  });

  describe("legacy-npm-declaration", () => {
    it("defines CoreBlow primary declaration and openclaw fallback", () => {
      expect(LEGACY_NPM_DECLARATION_FILE).toBe("coreblow.extension.json");
      expect(LEGACY_NPM_DECLARATION_FALLBACK_FILE).toBe("openclaw.extension.json");
    });

    it("returns null for non-existent directories", () => {
      expect(readLegacyNpmPluginDeclaration("/non/existent/dir")).toBeNull();
    });
  });

  describe("source-loader", () => {
    it("creates a plugin source loader function", () => {
      const loader = createPluginSourceLoader();
      expect(typeof loader).toBe("function");
    });
  });

  describe("text-transforms.runtime", () => {
    it("resolves runtime text transforms without error", () => {
      const transforms = resolveRuntimeTextTransforms();
      // May be undefined when no registry or text transforms are registered
      expect(transforms === undefined || typeof transforms === "object").toBe(true);
    });
  });

  describe("bundled-package-channel-metadata", () => {
    it("lists bundled package channel metadata", () => {
      const channels = listBundledPackageChannelMetadata();
      expect(Array.isArray(channels)).toBe(true);
    });

    it("finds bundled package channel metadata by id", () => {
      const channel = findBundledPackageChannelMetadata("non-existent-channel-xyz");
      expect(channel).toBeUndefined();
    });
  });

  describe("web-fetch-providers.shared", () => {
    it("sorts web fetch providers alphabetically", () => {
      const providers = [
        { id: "beta", pluginId: "plugin-b" },
        { id: "alpha", pluginId: "plugin-a" },
      ] as never;
      const sorted = sortWebFetchProviders(providers);
      expect(sorted[0].id).toBe("alpha");
      expect(sorted[1].id).toBe("beta");
    });

    it("sorts web fetch providers for auto-detect by order", () => {
      const providers = [
        { id: "beta", pluginId: "plugin-b", autoDetectOrder: 10 },
        { id: "alpha", pluginId: "plugin-a", autoDetectOrder: 1 },
      ] as never;
      const sorted = sortWebFetchProvidersForAutoDetect(providers);
      expect(sorted[0].id).toBe("alpha");
      expect(sorted[1].id).toBe("beta");
    });

    it("resolves bundled web fetch resolution config", () => {
      const result = resolveBundledWebFetchResolutionConfig({});
      expect(result).toHaveProperty("config");
      expect(result).toHaveProperty("activationSourceConfig");
      expect(result).toHaveProperty("autoEnabledReasons");
    });
  });

  describe("web-content-extractors.runtime", () => {
    it("resolves plugin web content extractors", () => {
      const extractors = resolvePluginWebContentExtractors();
      expect(Array.isArray(extractors)).toBe(true);
    });
  });
});
