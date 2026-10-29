import type { CoreBlowConfig } from "coreblow/plugin-sdk/telegram-core";
import { describe, expect, it } from "vitest";
import { telegramApprovalCapability, telegramNativeApprovalAdapter } from "./approval-native.js";

function buildConfig(
  overrides?: Partial<NonNullable<NonNullable<CoreBlowConfig["channels"]>["telegram"]>>,
): CoreBlowConfig {
  return {
    channels: {
      telegram: {
        botToken: "tok",
        execApprovals: {
          enabled: true,
          approvers: ["8460800771"],
          target: "dm",
        },
        ...overrides,
      },
    },
  } as CoreBlowConfig;
}

describe("telegram native approval adapter", () => {
  it("describes the correct Telegram exec-approval setup path", () => {
    const text = (telegramApprovalCapability.describeExecApprovalSetup as any)?.({
      channel: "telegram",
      channelLabel: "Telegram",
    });

    expect(text).toContain("`channels.telegram.execApprovals.approvers`");
    expect(text).toContain("`commands.ownerAllowFrom`");
    expect(text).not.toContain("`channels.telegram.allowFrom`");
    expect(text).not.toContain("`channels.telegram.defaultTo`");
  });

  it("describes the named-account Telegram exec-approval setup path", () => {
    const text = (telegramApprovalCapability.describeExecApprovalSetup as any)?.({
      channel: "telegram",
      channelLabel: "Telegram",
      accountId: "work",
    });

    expect(text).toContain("`channels.telegram.accounts.work.execApprovals.approvers`");
    expect(text).toContain("`commands.ownerAllowFrom`");
  });

  it("normalizes direct-chat origin targets so DM dedupe can converge", async () => {
    const target = await (telegramNativeApprovalAdapter.native as any)?.resolveOriginTarget?.({
      cfg: buildConfig(),
      accountId: "default",
      approvalKind: "exec",
      request: {
        id: "req-1",
        request: {
          command: "echo hi",
          turnSourceChannel: "telegram",
          turnSourceTo: "telegram:8460800771",
          turnSourceAccountId: "default",
          sessionKey: "agent:main:telegram:direct:8460800771",
        },
        createdAtMs: 0,
        expiresAtMs: 1000,
      },
    });

    expect(target).toEqual({
      to: "8460800771",
      threadId: undefined,
    });
  });

  it("parses topic-scoped turn-source targets in the extension", async () => {
    const target = await (telegramNativeApprovalAdapter.native as any)?.resolveOriginTarget?.({
      cfg: buildConfig(),
      accountId: "default",
      approvalKind: "exec",
      request: {
        id: "req-topic-1",
        request: {
          command: "echo hi",
          turnSourceChannel: "telegram",
          turnSourceTo: "telegram:-1003841603622:topic:928",
          turnSourceAccountId: "default",
          sessionKey: "agent:main:telegram:group:-1003841603622:topic:928",
        },
        createdAtMs: 0,
        expiresAtMs: 1000,
      },
    });

    expect(target).toEqual({
      to: "-1003841603622",
      threadId: 928,
    });
  });

  it("splits native approval adapter correctly", () => {
    expect(telegramNativeApprovalAdapter).toBeDefined();
    expect(telegramNativeApprovalAdapter.command).toBeDefined();
    expect(telegramNativeApprovalAdapter.describeExecApprovalSetup).toBeDefined();
  });
});
