/** Seam boundary: config → secrets (38 imports) */
import { describe, expect, it } from "vitest";

import * as mod_config from "../config/config.js";
import * as mod_io from "../config/io.js";
import * as mod_legacy_migrate from "../config/legacy-migrate.js";
import * as mod_types_secrets from "../config/types.secrets.js";
import * as mod_validation from "../config/validation.js";
import * as mod_zod_schema_core from "../config/zod-schema.core.js";

describe("seam: config → secrets (38 imports)", () => {

  it("config/config → secrets boundary", () => {
    expect(mod_config).toBeDefined();
    expect(typeof mod_config).toBe("object");
  });

  it("config/io → secrets boundary", () => {
    expect(mod_io).toBeDefined();
    expect(typeof mod_io).toBe("object");
  });

  it("config/legacy-migrate → secrets boundary", () => {
    expect(mod_legacy_migrate).toBeDefined();
    expect(typeof mod_legacy_migrate).toBe("object");
  });

  it("config/types.secrets → secrets boundary", () => {
    expect(mod_types_secrets).toBeDefined();
    expect(typeof mod_types_secrets).toBe("object");
  });

  it("config/validation → secrets boundary", () => {
    expect(mod_validation).toBeDefined();
    expect(typeof mod_validation).toBe("object");
  });

  it("config/zod-schema.core → secrets boundary", () => {
    expect(mod_zod_schema_core).toBeDefined();
    expect(typeof mod_zod_schema_core).toBe("object");
  });
});

