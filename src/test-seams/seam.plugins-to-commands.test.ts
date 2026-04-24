/** Seam boundary: plugins → commands (40 imports) */
import { describe, expect, it } from "vitest";

import * as mod_manifest_registry from "../plugins/manifest-registry.js";
import * as mod_memory_runtime from "../plugins/memory-runtime.js";
import * as mod_provider_api_key_auth from "../plugins/provider-api-key-auth.js";
import * as mod_provider_api_key_auth_runtime from "../plugins/provider-api-key-auth.runtime.js";
import * as mod_provider_auth_choice from "../plugins/provider-auth-choice.js";
import * as mod_provider_auth_choice_helpers from "../plugins/provider-auth-choice-helpers.js";

describe("seam: plugins → commands (40 imports)", () => {

  it("plugins/manifest-registry → commands boundary", () => {
    expect(mod_manifest_registry).toBeDefined();
    expect(typeof mod_manifest_registry).toBe("object");
  });

  it("plugins/memory-runtime → commands boundary", () => {
    expect(mod_memory_runtime).toBeDefined();
    expect(typeof mod_memory_runtime).toBe("object");
  });

  it("plugins/provider-api-key-auth → commands boundary", () => {
    expect(mod_provider_api_key_auth).toBeDefined();
    expect(typeof mod_provider_api_key_auth).toBe("object");
  });

  it("plugins/provider-api-key-auth.runtime → commands boundary", () => {
    expect(mod_provider_api_key_auth_runtime).toBeDefined();
    expect(typeof mod_provider_api_key_auth_runtime).toBe("object");
  });

  it("plugins/provider-auth-choice → commands boundary", () => {
    expect(mod_provider_auth_choice).toBeDefined();
    expect(typeof mod_provider_auth_choice).toBe("object");
  });

  it("plugins/provider-auth-choice-helpers → commands boundary", () => {
    expect(mod_provider_auth_choice_helpers).toBeDefined();
    expect(typeof mod_provider_auth_choice_helpers).toBe("object");
  });
});

