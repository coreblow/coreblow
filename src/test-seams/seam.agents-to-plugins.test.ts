/** Seam boundary: agents → plugins (44 imports) */
import { describe, expect, it } from "vitest";

import * as mod_agent_paths from "../agents/agent-paths.js";
import * as mod_agent_scope from "../agents/agent-scope.js";
import * as mod_auth_profiles from "../agents/auth-profiles.js";
import * as mod_auth_profiles_identity from "../agents/auth-profiles/identity.js";
import * as mod_auth_profiles_profiles from "../agents/auth-profiles/profiles.js";
import * as mod_auth_profiles_types from "../agents/auth-profiles/types.js";

describe("seam: agents → plugins (44 imports)", () => {

  it("agents/agent-paths → plugins boundary", () => {
    expect(mod_agent_paths).toBeDefined();
    expect(typeof mod_agent_paths).toBe("object");
  });

  it("agents/agent-scope → plugins boundary", () => {
    expect(mod_agent_scope).toBeDefined();
    expect(typeof mod_agent_scope).toBe("object");
  });

  it("agents/auth-profiles → plugins boundary", () => {
    expect(mod_auth_profiles).toBeDefined();
    expect(typeof mod_auth_profiles).toBe("object");
  });

  it("agents/identity → plugins boundary", () => {
    expect(mod_auth_profiles_identity).toBeDefined();
    expect(typeof mod_auth_profiles_identity).toBe("object");
  });

  it("agents/profiles → plugins boundary", () => {
    expect(mod_auth_profiles_profiles).toBeDefined();
    expect(typeof mod_auth_profiles_profiles).toBe("object");
  });

  it("agents/types → plugins boundary", () => {
    expect(mod_auth_profiles_types).toBeDefined();
    expect(typeof mod_auth_profiles_types).toBe("object");
  });
});

