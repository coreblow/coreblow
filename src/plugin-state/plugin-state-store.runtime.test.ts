import { describe, expect, it } from "vitest";
import { resolvePluginStateDir, resolvePluginStateSqlitePath } from "./plugin-state-store.paths.js";

describe("plugin state runtime paths", () => {
  it("uses CoreBlow state directory for plugin state", () => {
    const env = { COREBLOW_STATE_DIR: "/tmp/coreblow-state" };

    expect(resolvePluginStateDir(env)).toBe("/tmp/coreblow-state/plugin-state");
    expect(resolvePluginStateSqlitePath(env)).toBe("/tmp/coreblow-state/plugin-state/state.sqlite");
  });
});
