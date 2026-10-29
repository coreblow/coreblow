import { describe, expect, it, vi } from "vitest";
import type { ResolvedSlackAccount } from "./accounts.js";
import type { CoreBlowConfig } from "./runtime-api.js";
import { collectSlackSecurityAuditFindings } from "./security-audit.js";

const { readChannelAllowFromStoreMock } = vi.hoisted(() => ({
  readChannelAllowFromStoreMock: vi.fn(async () => [] as string[]),
}));

vi.mock("coreblow/plugin-sdk/conversation-runtime", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  readChannelAllowFromStore: readChannelAllowFromStoreMock,
}));

function createSlackAccount(config: NonNullable<CoreBlowConfig["channels"]>["slack"]) {
  return {
    accountId: "default",
    enabled: true,
    botToken: "xoxb-test",
    botTokenSource: "config",
    appTokenSource: "config",
    config,
  } as ResolvedSlackAccount;
}

function createSlashCommandSlackConfig(
  options: { useAccessGroups?: boolean } = {},
): CoreBlowConfig {
  return {
    ...(options.useAccessGroups === undefined
      ? {}
      : { commands: { useAccessGroups: options.useAccessGroups } }),
    channels: {
      slack: {
        enabled: true,
        botToken: "xoxb-test",
        appToken: "xapp-test",
        groupPolicy: "open",
        slashCommand: { enabled: true },
      },
    },
  };
}

async function collectSlackFindingsForConfig(cfg: CoreBlowConfig) {
  readChannelAllowFromStoreMock.mockResolvedValue([]);
  return await collectSlackSecurityAuditFindings({
    cfg,
    account: createSlackAccount(cfg.channels!.slack),
    accountId: "default",
  });
}

describe("Slack security audit findings", () => {
  it("flags slash commands without a channel users allowlist", async () => {
    const findings = await collectSlackFindingsForConfig(createSlashCommandSlackConfig());

    const slashAllowlistFinding = findings.find(
      ({ checkId }) => checkId === "channels.slack.commands.slash.no_allowlists",
    );
    expect(slashAllowlistFinding?.severity).toBe("warn");
  });

  it("flags slash commands when access-group enforcement is disabled", async () => {
    const findings = await collectSlackFindingsForConfig(
      createSlashCommandSlackConfig({ useAccessGroups: false }),
    );

    const accessGroupFinding = findings.find(
      ({ checkId }) => checkId === "channels.slack.commands.slash.useAccessGroups_off",
    );
    expect(accessGroupFinding?.severity).toBe("critical");
  });
});
