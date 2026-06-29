import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveInstalledPluginIndexStorePath } from "./installed-plugin-index-store-path.js";

describe("resolveInstalledPluginIndexStorePath", () => {
  it("uses provided filePath when specified", () => {
    const customPath = "/custom/path/to/installs.json";
    expect(resolveInstalledPluginIndexStorePath({ filePath: customPath })).toBe(customPath);
  });

  it("uses provided stateDir when specified", () => {
    const stateDir = "/custom/state";
    const result = resolveInstalledPluginIndexStorePath({ stateDir });
    expect(result).toBe(path.join(stateDir, "plugins", "installs.json"));
  });

  it("uses env-resolved stateDir when no stateDir provided", () => {
    const env = { HOME: "/test/home" };
    const result = resolveInstalledPluginIndexStorePath({ env });
    // Should use resolveStateDir logic with provided env
    expect(result).toContain("plugins");
    expect(result).toContain("installs.json");
  });

  it("defaults to process.env when no options provided", () => {
    const result = resolveInstalledPluginIndexStorePath();
    expect(result).toContain("plugins");
    expect(result).toContain("installs.json");
  });

  it("filePath option takes precedence over stateDir", () => {
    const customPath = "/override/installs.json";
    const stateDir = "/ignored/state";
    expect(resolveInstalledPluginIndexStorePath({ filePath: customPath, stateDir })).toBe(
      customPath,
    );
  });
});
