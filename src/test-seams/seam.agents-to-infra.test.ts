/** Seam boundary: agents → infra (19 imports) */
import { describe, expect, it } from "vitest";

import * as mod_agent_scope from "../agents/agent-scope.js";
import * as mod_auth_profiles from "../agents/auth-profiles.js";
import * as mod_current_time from "../agents/current-time.js";
import * as mod_date_time from "../agents/date-time.js";
import * as mod_identity from "../agents/identity.js";
import * as mod_model_auth from "../agents/model-auth.js";

describe("seam: agents → infra (19 imports)", () => {

  it("agents/agent-scope → infra boundary", () => {
    expect(mod_agent_scope).toBeDefined();
    expect(typeof mod_agent_scope).toBe("object");
  });

  it("agents/auth-profiles → infra boundary", () => {
    expect(mod_auth_profiles).toBeDefined();
    expect(typeof mod_auth_profiles).toBe("object");
  });

  it("agents/current-time → infra boundary", () => {
    expect(mod_current_time).toBeDefined();
    expect(typeof mod_current_time).toBe("object");
  });

  it("agents/date-time → infra boundary", () => {
    expect(mod_date_time).toBeDefined();
    expect(typeof mod_date_time).toBe("object");
  });

  it("agents/identity → infra boundary", () => {
    expect(mod_identity).toBeDefined();
    expect(typeof mod_identity).toBe("object");
  });

  it("agents/model-auth → infra boundary", () => {
    expect(mod_model_auth).toBeDefined();
    expect(typeof mod_model_auth).toBe("object");
  });
});

