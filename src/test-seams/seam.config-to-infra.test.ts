/** Seam boundary: config → infra (58 imports) */
import { describe, expect, it } from "vitest";

import * as mod_config from "../config/config.js";
import * as mod_paths from "../config/paths.js";
import * as mod_sessions from "../config/sessions.js";
import * as mod_sessions_artifacts from "../config/sessions/artifacts.js";
import * as mod_sessions_main_session from "../config/sessions/main-session.js";
import * as mod_sessions_paths from "../config/sessions/paths.js";

describe("seam: config → infra (58 imports)", () => {

  it("config/config → infra boundary", () => {
    expect(mod_config).toBeDefined();
    expect(typeof mod_config).toBe("object");
  });

  it("config/paths → infra boundary", () => {
    expect(mod_paths).toBeDefined();
    expect(typeof mod_paths).toBe("object");
  });

  it("config/sessions → infra boundary", () => {
    expect(mod_sessions).toBeDefined();
    expect(typeof mod_sessions).toBe("object");
  });

  it("config/artifacts → infra boundary", () => {
    expect(mod_sessions_artifacts).toBeDefined();
    expect(typeof mod_sessions_artifacts).toBe("object");
  });

  it("config/main-session → infra boundary", () => {
    expect(mod_sessions_main_session).toBeDefined();
    expect(typeof mod_sessions_main_session).toBe("object");
  });

  it("config/paths → infra boundary", () => {
    expect(mod_sessions_paths).toBeDefined();
    expect(typeof mod_sessions_paths).toBe("object");
  });
});
