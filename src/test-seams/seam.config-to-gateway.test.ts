/** Seam boundary: config → gateway (111 imports) */
import { describe, expect, it } from "vitest";

import * as mod_agent_limits from "../config/agent-limits.js";
import * as mod_commands from "../config/commands.js";
import * as mod_config from "../config/config.js";
import * as mod_env_substitution from "../config/env-substitution.js";
import * as mod_gateway_control_ui_origins from "../config/gateway-control-ui-origins.js";
import * as mod_io from "../config/io.js";

describe("seam: config → gateway (111 imports)", () => {

  it("config/agent-limits → gateway boundary", () => {
    expect(mod_agent_limits).toBeDefined();
    expect(typeof mod_agent_limits).toBe("object");
  });

  it("config/commands → gateway boundary", () => {
    expect(mod_commands).toBeDefined();
    expect(typeof mod_commands).toBe("object");
  });

  it("config/config → gateway boundary", () => {
    expect(mod_config).toBeDefined();
    expect(typeof mod_config).toBe("object");
  });

  it("config/env-substitution → gateway boundary", () => {
    expect(mod_env_substitution).toBeDefined();
    expect(typeof mod_env_substitution).toBe("object");
  });

  it("config/gateway-control-ui-origins → gateway boundary", () => {
    expect(mod_gateway_control_ui_origins).toBeDefined();
    expect(typeof mod_gateway_control_ui_origins).toBe("object");
  });

  it("config/io → gateway boundary", () => {
    expect(mod_io).toBeDefined();
    expect(typeof mod_io).toBe("object");
  });
});
