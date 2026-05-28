import { describe, expect, it } from "vitest";
import {
  GATEWAY_STARTUP_CLOSE_CODE,
  GATEWAY_STARTUP_CLOSE_REASON,
  GATEWAY_STARTUP_PENDING_CLOSE_CAUSE,
  GATEWAY_STARTUP_RETRY_AFTER_MS,
  GATEWAY_STARTUP_UNAVAILABLE_REASON,
  gatewayStartupUnavailableDetails,
  isRetryableGatewayStartupUnavailableError,
  resolveGatewayStartupRetryAfterMs,
} from "./startup-unavailable.js";

function startupUnavailableError(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    code: "UNAVAILABLE",
    retryable: true,
    details: gatewayStartupUnavailableDetails(),
    ...overrides,
  };
}

describe("startup unavailable protocol utilities", () => {
  it("exposes the startup close and retry constants", () => {
    expect(GATEWAY_STARTUP_PENDING_CLOSE_CAUSE).toBe("startup-sidecars-pending");
    expect(GATEWAY_STARTUP_CLOSE_CODE).toBe(1013);
    expect(GATEWAY_STARTUP_CLOSE_REASON).toBe("gateway starting");
    expect(GATEWAY_STARTUP_RETRY_AFTER_MS).toBe(500);
  });

  it("creates startup unavailable details", () => {
    expect(gatewayStartupUnavailableDetails()).toEqual({
      reason: GATEWAY_STARTUP_UNAVAILABLE_REASON,
    });
  });

  it("recognizes retryable unavailable errors by code and details", () => {
    expect(isRetryableGatewayStartupUnavailableError(startupUnavailableError())).toBe(true);
    expect(
      isRetryableGatewayStartupUnavailableError(
        startupUnavailableError({ gatewayCode: "UNAVAILABLE", code: "OTHER" }),
      ),
    ).toBe(true);
  });

  it("rejects non-startup or non-retryable unavailable errors", () => {
    expect(isRetryableGatewayStartupUnavailableError(null)).toBe(false);
    expect(isRetryableGatewayStartupUnavailableError({})).toBe(false);
    expect(
      isRetryableGatewayStartupUnavailableError(startupUnavailableError({ retryable: false })),
    ).toBe(false);
    expect(
      isRetryableGatewayStartupUnavailableError(
        startupUnavailableError({ details: { reason: "other" } }),
      ),
    ).toBe(false);
    expect(
      isRetryableGatewayStartupUnavailableError(startupUnavailableError({ code: "INVALID" })),
    ).toBe(false);
  });

  it("resolves default retry delay for valid startup unavailable errors", () => {
    expect(resolveGatewayStartupRetryAfterMs(startupUnavailableError())).toBe(500);
    expect(
      resolveGatewayStartupRetryAfterMs(startupUnavailableError({ retryAfterMs: "slow" })),
    ).toBe(500);
  });

  it("floors and clamps retry delay into the protocol bounds", () => {
    expect(resolveGatewayStartupRetryAfterMs(startupUnavailableError({ retryAfterMs: 250.9 }))).toBe(
      250,
    );
    expect(resolveGatewayStartupRetryAfterMs(startupUnavailableError({ retryAfterMs: 5 }))).toBe(
      100,
    );
    expect(resolveGatewayStartupRetryAfterMs(startupUnavailableError({ retryAfterMs: 4_000 }))).toBe(
      2_000,
    );
  });

  it("returns null for non-retryable startup unavailable shapes", () => {
    expect(resolveGatewayStartupRetryAfterMs({ code: "UNAVAILABLE" })).toBeNull();
    expect(resolveGatewayStartupRetryAfterMs(startupUnavailableError({ retryable: false }))).toBeNull();
  });
});
