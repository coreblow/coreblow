import { describe, expect, it } from "vitest";
import type { CoreBlowConfig } from "../../config/config.js";
import { resolveHookClientIpConfig } from "./hook-client-ip-config.js";

describe("resolveHookClientIpConfig", () => {
  it("maps gateway trusted proxy settings into hook client IP config", () => {
    expect(
      resolveHookClientIpConfig({
        gateway: {
          trustedProxies: ["10.0.0.1"],
          allowRealIpFallback: true,
        },
      } as CoreBlowConfig),
    ).toEqual({
      trustedProxies: ["10.0.0.1"],
      allowRealIpFallback: true,
    });
  });

  it("keeps real IP fallback disabled unless explicitly true", () => {
    expect(
      resolveHookClientIpConfig({
        gateway: {
          allowRealIpFallback: false,
        },
      } as CoreBlowConfig),
    ).toEqual({
      trustedProxies: undefined,
      allowRealIpFallback: false,
    });
  });
});
