import { describe, expect, it } from "vitest";
import { OAUTH_REFRESH_CALL_TIMEOUT_MS, OAUTH_REFRESH_LOCK_OPTIONS } from "./constants.js";

function computeMinimumRetryBudgetMs(): number {
  let total = 0;
  for (let attempt = 0; attempt < OAUTH_REFRESH_LOCK_OPTIONS.retries.retries; attempt += 1) {
    total += Math.min(
      OAUTH_REFRESH_LOCK_OPTIONS.retries.maxTimeout,
      Math.max(
        OAUTH_REFRESH_LOCK_OPTIONS.retries.minTimeout,
        OAUTH_REFRESH_LOCK_OPTIONS.retries.minTimeout *
          OAUTH_REFRESH_LOCK_OPTIONS.retries.factor ** attempt,
      ),
    );
  }
  return total;
}

describe("OAuth refresh call timeout (invariants)", () => {
  it("OAUTH_REFRESH_CALL_TIMEOUT_MS is strictly below OAUTH_REFRESH_LOCK_OPTIONS.stale", () => {
    expect(OAUTH_REFRESH_CALL_TIMEOUT_MS).toBeLessThan(OAUTH_REFRESH_LOCK_OPTIONS.stale);
  });

  it("OAUTH_REFRESH_CALL_TIMEOUT_MS has a reasonable floor for OAuth token exchanges", () => {
    expect(OAUTH_REFRESH_CALL_TIMEOUT_MS).toBeGreaterThanOrEqual(30_000);
  });

  it("OAUTH_REFRESH_LOCK_OPTIONS.stale leaves a generous safety margin beyond the call timeout", () => {
    expect(OAUTH_REFRESH_LOCK_OPTIONS.stale - OAUTH_REFRESH_CALL_TIMEOUT_MS).toBeGreaterThanOrEqual(
      30_000,
    );
  });

  it("OAUTH_REFRESH_LOCK_OPTIONS.stale is well above the slow-refresh ceiling", () => {
    expect(OAUTH_REFRESH_LOCK_OPTIONS.stale).toBeGreaterThan(60_000);
  });

  it("OAUTH_REFRESH_LOCK_OPTIONS retry budget outlasts the refresh call timeout", () => {
    expect(computeMinimumRetryBudgetMs()).toBeGreaterThan(OAUTH_REFRESH_CALL_TIMEOUT_MS);
  });
});
