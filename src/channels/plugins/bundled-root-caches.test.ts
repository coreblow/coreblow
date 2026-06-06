import { describe, expect, it } from "vitest";
import { resolveBundledChannelRootScope } from "./bundled-root.js";

describe("bundled root-aware plugin lookups", () => {
  it("resolves bundled channel root scope from bundled plugin env override", () => {
    const scope = resolveBundledChannelRootScope({
      COREBLOW_BUNDLED_PLUGINS_DIR: "/opt/coreblow/extensions",
    });
    expect(scope).toEqual({
      packageRoot: "/opt/coreblow",
      cacheKey: "/opt/coreblow/extensions",
      pluginsDir: "/opt/coreblow/extensions",
    });
  });
});
