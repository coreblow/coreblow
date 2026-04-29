/** Seam boundary: infra → gateway (92 imports) */
import { describe, expect, it } from "vitest";

import * as mod_agent_events from "../infra/agent-events.js";
import * as mod_backoff from "../infra/backoff.js";
import * as mod_bonjour from "../infra/bonjour.js";
import * as mod_boundary_file_read from "../infra/boundary-file-read.js";
import * as mod_canvas_host_url from "../infra/canvas-host-url.js";
import * as mod_control_ui_assets from "../infra/control-ui-assets.js";

describe("seam: infra → gateway (92 imports)", () => {

  it("infra/agent-events → gateway boundary", () => {
    expect(mod_agent_events).toBeDefined();
    expect(typeof mod_agent_events).toBe("object");
  });

  it("infra/backoff → gateway boundary", () => {
    expect(mod_backoff).toBeDefined();
    expect(typeof mod_backoff).toBe("object");
  });

  it("infra/bonjour → gateway boundary", () => {
    expect(mod_bonjour).toBeDefined();
    expect(typeof mod_bonjour).toBe("object");
  });

  it("infra/boundary-file-read → gateway boundary", () => {
    expect(mod_boundary_file_read).toBeDefined();
    expect(typeof mod_boundary_file_read).toBe("object");
  });

  it("infra/canvas-host-url → gateway boundary", () => {
    expect(mod_canvas_host_url).toBeDefined();
    expect(typeof mod_canvas_host_url).toBe("object");
  });

  it("infra/control-ui-assets → gateway boundary", () => {
    expect(mod_control_ui_assets).toBeDefined();
    expect(typeof mod_control_ui_assets).toBe("object");
  });
});
