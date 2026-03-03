import { describe, it, expect } from "vitest";

import { resolveNodeHostGatewayCredentials, runNodeHost } from "./runner.js";

describe("resolveNodeHostGatewayCredentials", () => {
  it("resolves all imports without errors", () => {
    expect(resolveNodeHostGatewayCredentials).toBeDefined();
    expect(runNodeHost).toBeDefined();
  });

  it.todo("does not inherit gateway.remote token in local mode");
  it.todo("ignores unresolved gateway.remote token refs in local mode");
  it.todo("resolves remote token SecretRef values");
  it.todo("prefers COREBLOW_GATEWAY_TOKEN over configured refs");
  it.todo("throws when a configured remote token ref cannot resolve");
  it.todo("does not resolve remote password refs when token auth is already available");
});
