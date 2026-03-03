/** Seam boundary: config → agents (138 imports) */
import { describe, expect, it } from "vitest";

import * as mod_agent_limits from "../config/agent-limits.js";
import * as mod_config from "../config/config.js";
import * as mod_env_vars from "../config/env-vars.js";
import * as mod_group_policy from "../config/group-policy.js";
import * as mod_mcp_config from "../config/mcp-config.js";
import * as mod_merge_patch from "../config/merge-patch.js";

describe("seam: config → agents (138 imports)", () => {

  it("config/agent-limits → agents boundary", () => {
    expect(mod_agent_limits).toBeDefined();
    expect(typeof mod_agent_limits).toBe("object");
  });

  it("config/config → agents boundary", () => {
    expect(mod_config).toBeDefined();
    expect(typeof mod_config).toBe("object");
  });

  it("config/env-vars → agents boundary", () => {
    expect(mod_env_vars).toBeDefined();
    expect(typeof mod_env_vars).toBe("object");
  });

  it("config/group-policy → agents boundary", () => {
    expect(mod_group_policy).toBeDefined();
    expect(typeof mod_group_policy).toBe("object");
  });

  it("config/mcp-config → agents boundary", () => {
    expect(mod_mcp_config).toBeDefined();
    expect(typeof mod_mcp_config).toBe("object");
  });

  it("config/merge-patch → agents boundary", () => {
    expect(mod_merge_patch).toBeDefined();
    expect(typeof mod_merge_patch).toBe("object");
  });
});

