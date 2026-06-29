import { describe, expect, it, afterEach } from "vitest";
import { resolvePluginActivationSourceConfig } from "./activation-source-config.js";
import {
  setRuntimeConfigSnapshot,
  resetConfigRuntimeState,
} from "../config/runtime-snapshot.js";
import type { CoreBlowConfig } from "../config/types.js";

describe("resolvePluginActivationSourceConfig", () => {
  afterEach(() => {
    resetConfigRuntimeState();
  });

  it("returns activationSourceConfig when explicitly provided", () => {
    const explicit: CoreBlowConfig = { gateway: { port: 9000 } };
    const result = resolvePluginActivationSourceConfig({
      config: { gateway: { port: 8080 } },
      activationSourceConfig: explicit,
    });
    expect(result).toBe(explicit);
  });

  it("returns source snapshot when config matches runtime snapshot", () => {
    const sourceConfig: CoreBlowConfig = { gateway: { port: 8080 } };
    const runtimeConfig: CoreBlowConfig = { gateway: { port: 8081 } };
    setRuntimeConfigSnapshot(runtimeConfig, sourceConfig);

    const result = resolvePluginActivationSourceConfig({ config: runtimeConfig });
    expect(result).toBe(sourceConfig);
  });

  it("returns provided config when it does not match runtime snapshot", () => {
    const sourceConfig: CoreBlowConfig = { gateway: { port: 8080 } };
    const runtimeConfig: CoreBlowConfig = { gateway: { port: 8081 } };
    const differentConfig: CoreBlowConfig = { gateway: { port: 9000 } };
    setRuntimeConfigSnapshot(runtimeConfig, sourceConfig);

    const result = resolvePluginActivationSourceConfig({ config: differentConfig });
    expect(result).toBe(differentConfig);
  });

  it("returns empty object when no config or activationSourceConfig provided", () => {
    const result = resolvePluginActivationSourceConfig({});
    expect(result).toEqual({});
  });

  it("returns provided config when no runtime snapshot exists", () => {
    const config: CoreBlowConfig = { gateway: { port: 8080 } };
    const result = resolvePluginActivationSourceConfig({ config });
    expect(result).toBe(config);
  });
});
