import { describe, it, expect } from "vitest";
import {
  trimToUndefined,
  trimCredentialToUndefined,
  readGatewayTokenEnv,
  readGatewayPasswordEnv,
  hasGatewayTokenEnvCandidate,
  hasGatewayPasswordEnvCandidate,
  createGatewayCredentialPlan,
} from "./credential-planner.js";

describe("trimToUndefined", () => {
  it("returns trimmed string for non-empty values", () => {
    expect(trimToUndefined("  hello  ")).toBe("hello");
    expect(trimToUndefined("token")).toBe("token");
  });

  it("returns undefined for empty or whitespace-only strings", () => {
    expect(trimToUndefined("")).toBeUndefined();
    expect(trimToUndefined("   ")).toBeUndefined();
  });

  it("returns undefined for non-string values", () => {
    expect(trimToUndefined(undefined)).toBeUndefined();
    expect(trimToUndefined(null)).toBeUndefined();
    expect(trimToUndefined(42)).toBeUndefined();
    expect(trimToUndefined({})).toBeUndefined();
  });
});

describe("trimCredentialToUndefined", () => {
  it("returns value for normal credentials", () => {
    expect(trimCredentialToUndefined("sk-abc123")).toBe("sk-abc123");
  });

  it("rejects unresolved env var placeholders", () => {
    expect(trimCredentialToUndefined("${SOME_VAR}")).toBeUndefined();
    expect(trimCredentialToUndefined("prefix-${TOKEN}-suffix")).toBeUndefined();
  });

  it("returns undefined for empty values", () => {
    expect(trimCredentialToUndefined("")).toBeUndefined();
    expect(trimCredentialToUndefined(null)).toBeUndefined();
  });
});

describe("readGatewayTokenEnv / readGatewayPasswordEnv", () => {
  it("reads token from env", () => {
    expect(readGatewayTokenEnv({ COREBLOW_GATEWAY_TOKEN: "my-token" } as any)).toBe("my-token");
    expect(readGatewayTokenEnv({} as any)).toBeUndefined();
    expect(readGatewayTokenEnv({ COREBLOW_GATEWAY_TOKEN: "  " } as any)).toBeUndefined();
  });

  it("reads password from env", () => {
    expect(readGatewayPasswordEnv({ COREBLOW_GATEWAY_PASSWORD: "my-pass" } as any)).toBe("my-pass");
    expect(readGatewayPasswordEnv({} as any)).toBeUndefined();
  });

  it("hasGatewayTokenEnvCandidate detects presence", () => {
    expect(hasGatewayTokenEnvCandidate({ COREBLOW_GATEWAY_TOKEN: "tok" } as any)).toBe(true);
    expect(hasGatewayTokenEnvCandidate({} as any)).toBe(false);
  });

  it("hasGatewayPasswordEnvCandidate detects presence", () => {
    expect(hasGatewayPasswordEnvCandidate({ COREBLOW_GATEWAY_PASSWORD: "pw" } as any)).toBe(true);
    expect(hasGatewayPasswordEnvCandidate({} as any)).toBe(false);
  });
});

describe("createGatewayCredentialPlan", () => {
  it("returns local mode by default", () => {
    const plan = createGatewayCredentialPlan({ config: {}, env: {} as any });
    expect(plan.configuredMode).toBe("local");
    expect(plan.remoteMode).toBe(false);
  });

  it("returns remote mode when gateway.mode is remote", () => {
    const plan = createGatewayCredentialPlan({
      config: { gateway: { mode: "remote" } } as any,
      env: {} as any,
    });
    expect(plan.configuredMode).toBe("remote");
    expect(plan.remoteMode).toBe(true);
  });

  it("detects env token", () => {
    const plan = createGatewayCredentialPlan({
      config: {},
      env: { COREBLOW_GATEWAY_TOKEN: "tok123" } as any,
    });
    expect(plan.envToken).toBe("tok123");
    expect(plan.tokenCanWin).toBe(true);
  });

  it("detects env password", () => {
    const plan = createGatewayCredentialPlan({
      config: {},
      env: { COREBLOW_GATEWAY_PASSWORD: "pass123" } as any,
    });
    expect(plan.envPassword).toBe("pass123");
  });

  it("detects tailscale remote exposure", () => {
    const plan = createGatewayCredentialPlan({
      config: { gateway: { tailscale: { mode: "funnel" } } } as any,
      env: {} as any,
    });
    expect(plan.tailscaleRemoteExposure).toBe(true);
    expect(plan.remoteConfiguredSurface).toBe(true);
  });

  it("localTokenCanWin is false when authMode is password", () => {
    const plan = createGatewayCredentialPlan({
      config: { gateway: { auth: { mode: "password" } } } as any,
      env: {} as any,
    });
    expect(plan.localTokenCanWin).toBe(false);
    expect(plan.passwordCanWin).toBe(true);
  });

  it("localTokenCanWin is false when authMode is none", () => {
    const plan = createGatewayCredentialPlan({
      config: { gateway: { auth: { mode: "none" } } } as any,
      env: {} as any,
    });
    expect(plan.localTokenCanWin).toBe(false);
  });
});
