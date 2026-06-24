import { describe, expect, it } from "vitest";
import { resolveBrowserConfig, resolveProfile } from "./browser-profiles.js";
import { shouldAutoGenerateBrowserAuth } from "./browser-control-auth.js";

describe("plugin-sdk browser facades", () => {
  it("resolves CoreBlow browser profiles through the native browser extension", () => {
    const resolved = resolveBrowserConfig(undefined);
    expect(resolved.enabled).toBe(true);
    expect(resolveProfile(resolved, resolved.defaultProfile)?.name).toBe(resolved.defaultProfile);
  });

  it("does not generate browser auth in test environments", () => {
    expect(shouldAutoGenerateBrowserAuth({ NODE_ENV: "test" })).toBe(false);
    expect(shouldAutoGenerateBrowserAuth({ VITEST: "true" })).toBe(false);
  });
});
