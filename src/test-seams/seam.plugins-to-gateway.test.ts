/** Seam boundary: plugins → gateway (37 imports) */
import { describe, expect, it } from "vitest";

import * as mod_channel_plugin_ids from "../plugins/channel-plugin-ids.js";
import * as mod_config_state from "../plugins/config-state.js";
import * as mod_discovery from "../plugins/discovery.js";
import * as mod_hook_runner_global from "../plugins/hook-runner-global.js";
import * as mod_loader from "../plugins/loader.js";
import * as mod_manifest_registry from "../plugins/manifest-registry.js";

describe("seam: plugins → gateway (37 imports)", () => {

  it("plugins/channel-plugin-ids → gateway boundary", () => {
    expect(mod_channel_plugin_ids).toBeDefined();
    expect(typeof mod_channel_plugin_ids).toBe("object");
  });

  it("plugins/config-state → gateway boundary", () => {
    expect(mod_config_state).toBeDefined();
    expect(typeof mod_config_state).toBe("object");
  });

  it("plugins/discovery → gateway boundary", () => {
    expect(mod_discovery).toBeDefined();
    expect(typeof mod_discovery).toBe("object");
  });

  it("plugins/hook-runner-global → gateway boundary", () => {
    expect(mod_hook_runner_global).toBeDefined();
    expect(typeof mod_hook_runner_global).toBe("object");
  });

  it("plugins/loader → gateway boundary", () => {
    expect(mod_loader).toBeDefined();
    expect(typeof mod_loader).toBe("object");
  });

  it("plugins/manifest-registry → gateway boundary", () => {
    expect(mod_manifest_registry).toBeDefined();
    expect(typeof mod_manifest_registry).toBe("object");
  });
});

