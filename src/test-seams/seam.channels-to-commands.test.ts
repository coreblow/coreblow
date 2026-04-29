/** Seam boundary: channels → commands (28 imports) */
import { describe, expect, it } from "vitest";

import * as mod_config_presence from "../channels/config-presence.js";
import * as mod_plugins_bundled from "../channels/plugins/bundled.js";
import * as mod_plugins_catalog from "../channels/plugins/catalog.js";
import * as mod_plugins_helpers from "../channels/plugins/helpers.js";
import * as mod_plugins_index from "../channels/plugins/index.js";
import * as mod_plugins_setup_helpers from "../channels/plugins/setup-helpers.js";

describe("seam: channels → commands (28 imports)", () => {

  it("channels/config-presence → commands boundary", () => {
    expect(mod_config_presence).toBeDefined();
    expect(typeof mod_config_presence).toBe("object");
  });

  it("channels/bundled → commands boundary", () => {
    expect(mod_plugins_bundled).toBeDefined();
    expect(typeof mod_plugins_bundled).toBe("object");
  });

  it("channels/catalog → commands boundary", () => {
    expect(mod_plugins_catalog).toBeDefined();
    expect(typeof mod_plugins_catalog).toBe("object");
  });

  it("channels/helpers → commands boundary", () => {
    expect(mod_plugins_helpers).toBeDefined();
    expect(typeof mod_plugins_helpers).toBe("object");
  });

  it("channels/index → commands boundary", () => {
    expect(mod_plugins_index).toBeDefined();
    expect(typeof mod_plugins_index).toBe("object");
  });

  it("channels/setup-helpers → commands boundary", () => {
    expect(mod_plugins_setup_helpers).toBeDefined();
    expect(typeof mod_plugins_setup_helpers).toBe("object");
  });
});
