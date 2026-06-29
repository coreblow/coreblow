import { describe, expect, it } from "vitest";
import {
  getExternalizedBundledPluginCoreHubSpec,
  getExternalizedBundledPluginLegacyPathSuffix,
  getExternalizedBundledPluginLookupIds,
  getExternalizedBundledPluginNpmSpec,
  getExternalizedBundledPluginPreferredSource,
  getExternalizedBundledPluginTargetId,
  type ExternalizedBundledPluginBridge,
} from "./externalized-bundled-plugins.js";

describe("externalized bundled plugin bridge", () => {
  it("defaults preferred source to npm when nothing else is set", () => {
    const bridge: ExternalizedBundledPluginBridge = { bundledPluginId: "demo" };
    expect(getExternalizedBundledPluginPreferredSource(bridge)).toBe("npm");
  });

  it("prefers corehub when only a corehub spec is declared", () => {
    const bridge: ExternalizedBundledPluginBridge = {
      bundledPluginId: "demo",
      corehubSpec: "demo-pkg",
    };
    expect(getExternalizedBundledPluginPreferredSource(bridge)).toBe("corehub");
  });

  it("honors an explicit preferredSource over inference", () => {
    const bridge: ExternalizedBundledPluginBridge = {
      bundledPluginId: "demo",
      preferredSource: "npm",
      corehubSpec: "demo-pkg",
    };
    expect(getExternalizedBundledPluginPreferredSource(bridge)).toBe("npm");
  });

  it("resolves the npm and corehub specs", () => {
    const bridge: ExternalizedBundledPluginBridge = {
      bundledPluginId: "demo",
      npmSpec: "  demo-pkg  ",
      corehubSpec: "  demo:1.0.0  ",
    };
    expect(getExternalizedBundledPluginNpmSpec(bridge)).toBe("demo-pkg");
    expect(getExternalizedBundledPluginCoreHubSpec(bridge)).toBe("demo:1.0.0");
  });

  it("resolves the target id, falling back to bundledPluginId", () => {
    expect(
      getExternalizedBundledPluginTargetId({ bundledPluginId: "demo" }),
    ).toBe("demo");
    expect(
      getExternalizedBundledPluginTargetId({
        bundledPluginId: "demo",
        pluginId: "demo-external",
      }),
    ).toBe("demo-external");
  });

  it("collects deduplicated lookup ids from all known aliases", () => {
    const ids = getExternalizedBundledPluginLookupIds({
      bundledPluginId: "demo",
      pluginId: "demo",
      legacyPluginIds: ["legacy-demo"],
      channelIds: ["demo-channel", "legacy-demo"],
    });
    expect(ids).toEqual(["demo", "legacy-demo", "demo-channel"]);
  });

  it("builds the legacy extensions path suffix", () => {
    expect(
      getExternalizedBundledPluginLegacyPathSuffix({ bundledPluginId: "demo" }),
    ).toBe("extensions/demo");
    expect(
      getExternalizedBundledPluginLegacyPathSuffix({
        bundledPluginId: "demo",
        bundledDirName: "demo-dir",
      }),
    ).toBe("extensions/demo-dir");
  });
});
