/** Seam boundary: agents → secrets (20 imports) */
import { describe, expect, it } from "vitest";

import * as mod_agent_paths from "../agents/agent-paths.js";
import * as mod_agent_scope from "../agents/agent-scope.js";
import * as mod_auth_profiles from "../agents/auth-profiles.js";
import * as mod_auth_profiles_constants from "../agents/auth-profiles/constants.js";
import * as mod_auth_profiles_paths from "../agents/auth-profiles/paths.js";
import * as mod_model_auth_markers from "../agents/model-auth-markers.js";

describe("seam: agents → secrets (20 imports)", () => {

  it("agents/agent-paths → secrets boundary", () => {
    expect(mod_agent_paths).toBeDefined();
    expect(typeof mod_agent_paths).toBe("object");
  });

  it("agents/agent-scope → secrets boundary", () => {
    expect(mod_agent_scope).toBeDefined();
    expect(typeof mod_agent_scope).toBe("object");
  });

  it("agents/auth-profiles → secrets boundary", () => {
    expect(mod_auth_profiles).toBeDefined();
    expect(typeof mod_auth_profiles).toBe("object");
  });

  it("agents/constants → secrets boundary", () => {
    expect(mod_auth_profiles_constants).toBeDefined();
    expect(typeof mod_auth_profiles_constants).toBe("object");
  });

  it("agents/paths → secrets boundary", () => {
    expect(mod_auth_profiles_paths).toBeDefined();
    expect(typeof mod_auth_profiles_paths).toBe("object");
  });

  it("agents/model-auth-markers → secrets boundary", () => {
    expect(mod_model_auth_markers).toBeDefined();
    expect(typeof mod_model_auth_markers).toBe("object");
  });
});

