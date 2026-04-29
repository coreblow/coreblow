/** Seam boundary: config → plugins (83 imports) */
import { describe, expect, it } from "vitest";

import * as mod_allowed_values from "../config/allowed-values.js";
import * as mod_channel_configured from "../config/channel-configured.js";
import * as mod_config from "../config/config.js";
import * as mod_merge_patch from "../config/merge-patch.js";
import * as mod_model_input from "../config/model-input.js";
import * as mod_paths from "../config/paths.js";

describe("seam: config → plugins (83 imports)", () => {

  it("config/allowed-values → plugins boundary", () => {
    expect(mod_allowed_values).toBeDefined();
    expect(typeof mod_allowed_values).toBe("object");
  });

  it("config/channel-configured → plugins boundary", () => {
    expect(mod_channel_configured).toBeDefined();
    expect(typeof mod_channel_configured).toBe("object");
  });

  it("config/config → plugins boundary", () => {
    expect(mod_config).toBeDefined();
    expect(typeof mod_config).toBe("object");
  });

  it("config/merge-patch → plugins boundary", () => {
    expect(mod_merge_patch).toBeDefined();
    expect(typeof mod_merge_patch).toBe("object");
  });

  it("config/model-input → plugins boundary", () => {
    expect(mod_model_input).toBeDefined();
    expect(typeof mod_model_input).toBe("object");
  });

  it("config/paths → plugins boundary", () => {
    expect(mod_paths).toBeDefined();
    expect(typeof mod_paths).toBe("object");
  });
});
