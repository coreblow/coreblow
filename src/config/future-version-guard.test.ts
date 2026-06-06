import { describe, expect, it } from "vitest";
import {
  ALLOW_OLDER_BINARY_DESTRUCTIVE_ACTIONS_ENV,
  formatFutureConfigActionBlock,
  resolveFutureConfigActionBlock,
} from "./future-version-guard.js";

describe("future config action guard", () => {
  it("blocks destructive actions from an older CoreBlow binary", () => {
    const block = resolveFutureConfigActionBlock({
      action: "write config",
      currentVersion: "1.0.0",
      config: { meta: { lastTouchedVersion: "2.0.0" } },
      env: {},
    });

    expect(block).toMatchObject({
      action: "write config",
      currentVersion: "1.0.0",
      touchedVersion: "2.0.0",
    });
    expect(block?.message).toContain("CoreBlow binary (1.0.0) is older");
    expect(formatFutureConfigActionBlock(block!)).toContain(
      ALLOW_OLDER_BINARY_DESTRUCTIVE_ACTIONS_ENV,
    );
  });

  it("allows same stable family and explicit downgrade recovery", () => {
    expect(
      resolveFutureConfigActionBlock({
        action: "write config",
        currentVersion: "1.0.0",
        config: { meta: { lastTouchedVersion: "1.0.0" } },
        env: {},
      }),
    ).toBeNull();

    expect(
      resolveFutureConfigActionBlock({
        action: "write config",
        currentVersion: "1.0.0",
        config: { meta: { lastTouchedVersion: "2.0.0" } },
        env: { [ALLOW_OLDER_BINARY_DESTRUCTIVE_ACTIONS_ENV]: "true" },
      }),
    ).toBeNull();
  });
});
