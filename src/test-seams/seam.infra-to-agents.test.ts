/** Seam boundary: infra → agents (88 imports) */
import { describe, expect, it } from "vitest";

import * as mod_agent_events from "../infra/agent-events.js";
import * as mod_archive from "../infra/archive.js";
import * as mod_archive_path from "../infra/archive-path.js";
import * as mod_backoff from "../infra/backoff.js";
import * as mod_boundary_file_read from "../infra/boundary-file-read.js";
import * as mod_brew from "../infra/brew.js";

describe("seam: infra → agents (88 imports)", () => {

  it("infra/agent-events → agents boundary", () => {
    expect(mod_agent_events).toBeDefined();
    expect(typeof mod_agent_events).toBe("object");
  });

  it("infra/archive → agents boundary", () => {
    expect(mod_archive).toBeDefined();
    expect(typeof mod_archive).toBe("object");
  });

  it("infra/archive-path → agents boundary", () => {
    expect(mod_archive_path).toBeDefined();
    expect(typeof mod_archive_path).toBe("object");
  });

  it("infra/backoff → agents boundary", () => {
    expect(mod_backoff).toBeDefined();
    expect(typeof mod_backoff).toBe("object");
  });

  it("infra/boundary-file-read → agents boundary", () => {
    expect(mod_boundary_file_read).toBeDefined();
    expect(typeof mod_boundary_file_read).toBe("object");
  });

  it("infra/brew → agents boundary", () => {
    expect(mod_brew).toBeDefined();
    expect(typeof mod_brew).toBe("object");
  });
});
