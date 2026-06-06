import { describe, expect, it } from "vitest";
import {
  getBootstrapChannelPlugin,
  getBootstrapChannelSecrets,
  iterateBootstrapChannelPlugins,
  listBootstrapChannelPluginIds,
} from "./bootstrap-registry.js";

describe("bootstrap channel registry", () => {
  it("lists bundled channel plugin ids from the active root", () => {
    expect(listBootstrapChannelPluginIds()).toContain("telegram");
  });

  it("resolves bootstrap channel plugins without throwing on setup/runtime merges", () => {
    const plugin = getBootstrapChannelPlugin("telegram");
    expect(plugin?.id).toBe("telegram");
    expect(plugin?.meta.label).toBeTruthy();
  });

  it("iterates only loadable bootstrap plugins", () => {
    expect(Array.from(iterateBootstrapChannelPlugins()).some((plugin) => plugin.id === "telegram")).toBe(
      true,
    );
  });

  it("returns undefined for absent bootstrap secrets", () => {
    expect(getBootstrapChannelSecrets("")).toBeUndefined();
  });
});
