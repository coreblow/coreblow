/** Seam boundary: plugins → agents (43 imports) */
import { describe, expect, it } from "vitest";

import * as mod_bundle_lsp from "../plugins/bundle-lsp.js";
import * as mod_bundle_mcp from "../plugins/bundle-mcp.js";
import * as mod_cli_backends_runtime from "../plugins/cli-backends.runtime.js";
import * as mod_config_state from "../plugins/config-state.js";
import * as mod_discovery from "../plugins/discovery.js";
import * as mod_hook_runner_global from "../plugins/hook-runner-global.js";

describe("seam: plugins → agents (43 imports)", () => {

  it("plugins/bundle-lsp → agents boundary", () => {
    expect(mod_bundle_lsp).toBeDefined();
    expect(typeof mod_bundle_lsp).toBe("object");
  });

  it("plugins/bundle-mcp → agents boundary", () => {
    expect(mod_bundle_mcp).toBeDefined();
    expect(typeof mod_bundle_mcp).toBe("object");
  });

  it("plugins/cli-backends.runtime → agents boundary", () => {
    expect(mod_cli_backends_runtime).toBeDefined();
    expect(typeof mod_cli_backends_runtime).toBe("object");
  });

  it("plugins/config-state → agents boundary", () => {
    expect(mod_config_state).toBeDefined();
    expect(typeof mod_config_state).toBe("object");
  });

  it("plugins/discovery → agents boundary", () => {
    expect(mod_discovery).toBeDefined();
    expect(typeof mod_discovery).toBe("object");
  });

  it("plugins/hook-runner-global → agents boundary", () => {
    expect(mod_hook_runner_global).toBeDefined();
    expect(typeof mod_hook_runner_global).toBe("object");
  });
});
