/** Seam boundary: agents → gateway (76 imports) */
import { describe, expect, it } from "vitest";

import * as mod_agent_paths from "../agents/agent-paths.js";
import * as mod_agent_scope from "../agents/agent-scope.js";
import * as mod_auth_profiles from "../agents/auth-profiles.js";
import * as mod_bootstrap_cache from "../agents/bootstrap-cache.js";
import * as mod_command_types from "../agents/command/types.js";
import * as mod_context from "../agents/context.js";

describe("seam: agents → gateway (76 imports)", () => {

  it("agents/agent-paths → gateway boundary", () => {
    expect(mod_agent_paths).toBeDefined();
    expect(typeof mod_agent_paths).toBe("object");
  });

  it("agents/agent-scope → gateway boundary", () => {
    expect(mod_agent_scope).toBeDefined();
    expect(typeof mod_agent_scope).toBe("object");
  });

  it("agents/auth-profiles → gateway boundary", () => {
    expect(mod_auth_profiles).toBeDefined();
    expect(typeof mod_auth_profiles).toBe("object");
  });

  it("agents/bootstrap-cache → gateway boundary", () => {
    expect(mod_bootstrap_cache).toBeDefined();
    expect(typeof mod_bootstrap_cache).toBe("object");
  });

  it("agents/types → gateway boundary", () => {
    expect(mod_command_types).toBeDefined();
    expect(typeof mod_command_types).toBe("object");
  });

  it("agents/context → gateway boundary", () => {
    expect(mod_context).toBeDefined();
    expect(typeof mod_context).toBe("object");
  });
});
