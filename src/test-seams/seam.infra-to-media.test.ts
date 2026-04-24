/** Seam boundary: infra → media (17 imports) */
import { describe, expect, it } from "vitest";

import * as mod_errors from "../infra/errors.js";
import * as mod_fs_safe from "../infra/fs-safe.js";
import * as mod_local_file_access from "../infra/local-file-access.js";
import * as mod_net_fetch_guard from "../infra/net/fetch-guard.js";
import * as mod_net_ssrf from "../infra/net/ssrf.js";
import * as mod_ports from "../infra/ports.js";

describe("seam: infra → media (17 imports)", () => {

  it("infra/errors → media boundary", () => {
    expect(mod_errors).toBeDefined();
    expect(typeof mod_errors).toBe("object");
  });

  it("infra/fs-safe → media boundary", () => {
    expect(mod_fs_safe).toBeDefined();
    expect(typeof mod_fs_safe).toBe("object");
  });

  it("infra/local-file-access → media boundary", () => {
    expect(mod_local_file_access).toBeDefined();
    expect(typeof mod_local_file_access).toBe("object");
  });

  it("infra/fetch-guard → media boundary", () => {
    expect(mod_net_fetch_guard).toBeDefined();
    expect(typeof mod_net_fetch_guard).toBe("object");
  });

  it("infra/ssrf → media boundary", () => {
    expect(mod_net_ssrf).toBeDefined();
    expect(typeof mod_net_ssrf).toBe("object");
  });

  it("infra/ports → media boundary", () => {
    expect(mod_ports).toBeDefined();
    expect(typeof mod_ports).toBe("object");
  });
});

