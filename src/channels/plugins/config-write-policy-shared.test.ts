import { describe, expect, it } from "vitest";
import {
  authorizeConfigWriteShared,
  canBypassConfigWritePolicyShared,
  formatConfigWriteDeniedMessageShared,
  resolveChannelConfigWritesShared,
  resolveConfigWriteTargetFromPathShared,
  resolveExplicitConfigWriteTargetShared,
} from "./config-write-policy-shared.js";

const cfg = {
  channels: {
    telegram: {
      configWrites: true,
      accounts: {
        work: { configWrites: false },
      },
    },
    slack: {
      configWrites: false,
    },
  },
};

const normalizeChannelId = (raw: string) => raw.trim().toLowerCase() || null;

describe("config write policy shared", () => {
  it("resolves channel and account scoped write toggles", () => {
    expect(resolveChannelConfigWritesShared({ cfg, channelId: "telegram" })).toBe(true);
    expect(
      resolveChannelConfigWritesShared({ cfg, channelId: "telegram", accountId: "WORK" }),
    ).toBe(false);
    expect(resolveChannelConfigWritesShared({ cfg, channelId: "unknown" })).toBe(true);
  });

  it("authorizes and blocks writes using origin and target scopes", () => {
    const target = resolveExplicitConfigWriteTargetShared({
      channelId: "telegram",
      accountId: "work",
    });

    expect(
      authorizeConfigWriteShared({
        cfg,
        origin: { channelId: "telegram" },
        target,
      }),
    ).toEqual({
      allowed: false,
      reason: "target-disabled",
      blockedScope: {
        kind: "target",
        scope: { channelId: "telegram", accountId: "work" },
      },
    });

    expect(
      authorizeConfigWriteShared({
        cfg,
        origin: { channelId: "slack" },
        target: { kind: "global" },
      }),
    ).toEqual({
      allowed: false,
      reason: "origin-disabled",
      blockedScope: { kind: "origin", scope: { channelId: "slack" } },
    });
  });

  it("resolves path targets and formats denied messages", () => {
    expect(
      resolveConfigWriteTargetFromPathShared({
        path: ["channels", "Telegram", "accounts", "work"],
        normalizeChannelId,
      }),
    ).toEqual({
      kind: "account",
      scope: { channelId: "telegram", accountId: "work" },
    });

    expect(
      formatConfigWriteDeniedMessageShared({
        result: {
          allowed: false,
          reason: "target-disabled",
          blockedScope: {
            kind: "target",
            scope: { channelId: "telegram", accountId: "work" },
          },
        },
      }),
    ).toContain("channels.telegram.accounts.work.configWrites=true");
  });

  it("keeps internal bypass pluggable", () => {
    expect(
      canBypassConfigWritePolicyShared({
        channel: "internal",
        gatewayClientScopes: ["operator.admin"],
        isInternalMessageChannel: (channel) => channel === "internal",
      }),
    ).toBe(true);
  });
});
