import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createProfiler,
  formatPluginLoadProfileLine,
  shouldProfilePluginLoader,
  withProfile,
} from "./plugin-load-profile.js";

describe("shouldProfilePluginLoader", () => {
  const originalEnv = process.env.COREBLOW_PLUGIN_LOAD_PROFILE;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.COREBLOW_PLUGIN_LOAD_PROFILE;
    } else {
      process.env.COREBLOW_PLUGIN_LOAD_PROFILE = originalEnv;
    }
  });

  it("is false when the env flag is unset", () => {
    delete process.env.COREBLOW_PLUGIN_LOAD_PROFILE;
    expect(shouldProfilePluginLoader()).toBe(false);
  });

  it("is true only for the exact value \"1\"", () => {
    process.env.COREBLOW_PLUGIN_LOAD_PROFILE = "1";
    expect(shouldProfilePluginLoader()).toBe(true);
  });

  it("is false for truthy-looking but non-\"1\" values", () => {
    for (const value of ["true", "yes", "on", "0", ""]) {
      process.env.COREBLOW_PLUGIN_LOAD_PROFILE = value;
      expect(shouldProfilePluginLoader()).toBe(false);
    }
  });
});

describe("formatPluginLoadProfileLine", () => {
  it("renders the canonical field order: phase, plugin, elapsedMs, extras, source", () => {
    const line = formatPluginLoadProfileLine({
      phase: "resolve",
      pluginId: "my-plugin",
      source: "/path/to/plugin.js",
      elapsedMs: 12.345,
      extras: [["bytes", 4096], ["cacheHit", "false"]],
    });
    expect(line).toBe(
      "[plugin-load-profile] phase=resolve plugin=my-plugin elapsedMs=12.3 bytes=4096.0 cacheHit=false source=/path/to/plugin.js",
    );
  });

  it("falls back to (core) when pluginId is omitted", () => {
    const line = formatPluginLoadProfileLine({
      phase: "init",
      source: "core",
      elapsedMs: 1,
    });
    expect(line).toBe("[plugin-load-profile] phase=init plugin=(core) elapsedMs=1.0 source=core");
  });

  it("omits the extras fragment entirely when no extras are given", () => {
    const line = formatPluginLoadProfileLine({
      phase: "load",
      pluginId: "p",
      source: "s",
      elapsedMs: 0,
    });
    expect(line).not.toContain("  ");
    expect(line).toBe("[plugin-load-profile] phase=load plugin=p elapsedMs=0.0 source=s");
  });
});

describe("withProfile", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  const originalEnv = process.env.COREBLOW_PLUGIN_LOAD_PROFILE;

  beforeEach(() => {
    stderrSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    if (originalEnv === undefined) {
      delete process.env.COREBLOW_PLUGIN_LOAD_PROFILE;
    } else {
      process.env.COREBLOW_PLUGIN_LOAD_PROFILE = originalEnv;
    }
  });

  it("runs the callback and returns its value when profiling is disabled", () => {
    delete process.env.COREBLOW_PLUGIN_LOAD_PROFILE;
    const result = withProfile({ pluginId: "p", source: "s" }, "phase", () => 42);
    expect(result).toBe(42);
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it("runs the callback and emits a profile line when profiling is enabled", () => {
    process.env.COREBLOW_PLUGIN_LOAD_PROFILE = "1";
    const result = withProfile({ pluginId: "p", source: "s" }, "phase", () => 42);
    expect(result).toBe(42);
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    const [line] = stderrSpy.mock.calls[0] as [string];
    expect(line).toContain("[plugin-load-profile] phase=phase plugin=p");
    expect(line).toContain("source=s");
  });

  it("still emits the profile line and rethrows when the callback throws", () => {
    process.env.COREBLOW_PLUGIN_LOAD_PROFILE = "1";
    expect(() =>
      withProfile({ pluginId: "p", source: "s" }, "phase", () => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(stderrSpy).toHaveBeenCalledTimes(1);
  });

  it("has no timing overhead path (does not call performance.now) when disabled", () => {
    delete process.env.COREBLOW_PLUGIN_LOAD_PROFILE;
    const nowSpy = vi.spyOn(performance, "now");
    withProfile({ pluginId: "p", source: "s" }, "phase", () => 1);
    expect(nowSpy).not.toHaveBeenCalled();
    nowSpy.mockRestore();
  });
});

describe("createProfiler", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  const originalEnv = process.env.COREBLOW_PLUGIN_LOAD_PROFILE;

  beforeEach(() => {
    stderrSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    process.env.COREBLOW_PLUGIN_LOAD_PROFILE = "1";
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    if (originalEnv === undefined) {
      delete process.env.COREBLOW_PLUGIN_LOAD_PROFILE;
    } else {
      process.env.COREBLOW_PLUGIN_LOAD_PROFILE = originalEnv;
    }
  });

  it("binds pluginId and source across multiple calls", () => {
    const profile = createProfiler({ pluginId: "bound-plugin", source: "bound-source" });
    profile("phase-a", () => undefined);
    profile("phase-b", () => undefined);

    expect(stderrSpy).toHaveBeenCalledTimes(2);
    const [firstLine] = stderrSpy.mock.calls[0] as [string];
    const [secondLine] = stderrSpy.mock.calls[1] as [string];
    expect(firstLine).toContain("phase=phase-a plugin=bound-plugin");
    expect(firstLine).toContain("source=bound-source");
    expect(secondLine).toContain("phase=phase-b plugin=bound-plugin");
  });

  it("passes extras through to the emitted line", () => {
    const profile = createProfiler({ source: "s" });
    profile("phase", () => undefined, [["count", 3]]);
    const [line] = stderrSpy.mock.calls[0] as [string];
    expect(line).toContain("count=3.0");
  });
});
