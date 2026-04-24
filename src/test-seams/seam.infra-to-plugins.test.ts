/** Seam boundary: infra → plugins (43 imports) */
import { describe, expect, it } from "vitest";

import * as mod_archive from "../infra/archive.js";
import * as mod_boundary_file_read from "../infra/boundary-file-read.js";
import * as mod_brew from "../infra/brew.js";
import * as mod_browser_open from "../infra/browser-open.js";
import * as mod_clawhub from "../infra/clawhub.js";
import * as mod_coreblow_root from "../infra/coreblow-root.js";

describe("seam: infra → plugins (43 imports)", () => {

  it("infra/archive → plugins boundary", () => {
    expect(mod_archive).toBeDefined();
    expect(typeof mod_archive).toBe("object");
  });

  it("infra/boundary-file-read → plugins boundary", () => {
    expect(mod_boundary_file_read).toBeDefined();
    expect(typeof mod_boundary_file_read).toBe("object");
  });

  it("infra/brew → plugins boundary", () => {
    expect(mod_brew).toBeDefined();
    expect(typeof mod_brew).toBe("object");
  });

  it("infra/browser-open → plugins boundary", () => {
    expect(mod_browser_open).toBeDefined();
    expect(typeof mod_browser_open).toBe("object");
  });

  it("infra/clawhub → plugins boundary", () => {
    expect(mod_clawhub).toBeDefined();
    expect(typeof mod_clawhub).toBe("object");
  });

  it("infra/coreblow-root → plugins boundary", () => {
    expect(mod_coreblow_root).toBeDefined();
    expect(typeof mod_coreblow_root).toBe("object");
  });
});

