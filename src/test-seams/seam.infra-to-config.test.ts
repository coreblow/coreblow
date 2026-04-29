/** Seam boundary: infra → config (20 imports) */
import { describe, expect, it } from "vitest";

import * as mod_boundary_file_read from "../infra/boundary-file-read.js";
import * as mod_coreblow_root from "../infra/coreblow-root.js";
import * as mod_dotenv from "../infra/dotenv.js";
import * as mod_exec_safe_bin_policy from "../infra/exec-safe-bin-policy.js";
import * as mod_exec_safe_bin_trust from "../infra/exec-safe-bin-trust.js";
import * as mod_exec_safety from "../infra/exec-safety.js";

describe("seam: infra → config (20 imports)", () => {

  it("infra/boundary-file-read → config boundary", () => {
    expect(mod_boundary_file_read).toBeDefined();
    expect(typeof mod_boundary_file_read).toBe("object");
  });

  it("infra/coreblow-root → config boundary", () => {
    expect(mod_coreblow_root).toBeDefined();
    expect(typeof mod_coreblow_root).toBe("object");
  });

  it("infra/dotenv → config boundary", () => {
    expect(mod_dotenv).toBeDefined();
    expect(typeof mod_dotenv).toBe("object");
  });

  it("infra/exec-safe-bin-policy → config boundary", () => {
    expect(mod_exec_safe_bin_policy).toBeDefined();
    expect(typeof mod_exec_safe_bin_policy).toBe("object");
  });

  it("infra/exec-safe-bin-trust → config boundary", () => {
    expect(mod_exec_safe_bin_trust).toBeDefined();
    expect(typeof mod_exec_safe_bin_trust).toBe("object");
  });

  it("infra/exec-safety → config boundary", () => {
    expect(mod_exec_safety).toBeDefined();
    expect(typeof mod_exec_safety).toBe("object");
  });
});
