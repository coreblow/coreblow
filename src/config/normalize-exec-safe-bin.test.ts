import { describe, expect, it } from "vitest";
import { normalizeExecSafeBinProfilesInConfig } from "./normalize-exec-safe-bin.js";

describe("normalizeExecSafeBinProfilesInConfig()", () => {
  it("does not throw for empty config", () => {
    expect(() => normalizeExecSafeBinProfilesInConfig({} as never)).not.toThrow();
  });

  it("does not throw when tools.exec is missing", () => {
    expect(() => normalizeExecSafeBinProfilesInConfig({ tools: {} } as never)).not.toThrow();
  });

  it("does not throw when tools.exec is present with empty safeBinProfiles", () => {
    expect(() =>
      normalizeExecSafeBinProfilesInConfig({
        tools: { exec: { safeBinProfiles: {} } },
      } as never)
    ).not.toThrow();
  });

  it("does not throw with agents list", () => {
    expect(() =>
      normalizeExecSafeBinProfilesInConfig({
        agents: { list: [{ tools: { exec: { safeBinProfiles: {} } } }] },
      } as never)
    ).not.toThrow();
  });

  it("does not throw when agents list is empty", () => {
    expect(() =>
      normalizeExecSafeBinProfilesInConfig({ agents: { list: [] } } as never)
    ).not.toThrow();
  });

  it("mutates safeBinProfiles to undefined when empty", () => {
    const cfg = { tools: { exec: { safeBinProfiles: {} } } } as never;
    normalizeExecSafeBinProfilesInConfig(cfg);
    expect((cfg as Record<string, unknown> & { tools: { exec: { safeBinProfiles?: unknown } } }).tools.exec.safeBinProfiles).toBeUndefined();
  });
});
