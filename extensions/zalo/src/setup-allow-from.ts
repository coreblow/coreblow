import { DEFAULT_ACCOUNT_ID, mergeAllowFromEntries, type CoreBlowConfig } from "coreblow/plugin-sdk/setup";
import { resolveDefaultZaloAccountId, resolveZaloAccount } from "./accounts.js";

export async function noteZaloTokenHelp(prompter: {
  note: (message: string, title?: string) => Promise<void>;
}): Promise<void> {
  await prompter.note(
    [
      "Open Zalo Bot Platform: https://bot.zaloplatforms.com",
      "Create a bot and copy its token.",
      "Set ZALO_BOT_TOKEN or save the token in CoreBlow config.",
    ].join("\n"),
    "Zalo bot token",
  );
}

export async function promptZaloAllowFrom(params: {
  cfg: CoreBlowConfig;
  prompter: {
    text: (params: {
      message: string;
      placeholder?: string;
      initialValue?: string;
      validate?: (value: string | undefined) => string | undefined;
    }) => Promise<string>;
  };
  accountId?: string;
}): Promise<CoreBlowConfig> {
  const accountId = params.accountId ?? resolveDefaultZaloAccountId(params.cfg);
  const resolved = resolveZaloAccount({ cfg: params.cfg, accountId });
  const entry = await params.prompter.text({
    message: "Zalo allowFrom (user id)",
    placeholder: "123456789",
    initialValue: resolved.config.allowFrom?.[0]
      ? String(resolved.config.allowFrom[0])
      : undefined,
    validate: (value) => (/^\d+$/.test(String(value ?? "").trim()) ? undefined : "Use a numeric Zalo user id"),
  });
  const allowFrom = mergeAllowFromEntries(resolved.config.allowFrom ?? [], [entry.trim()]);
  if (accountId === DEFAULT_ACCOUNT_ID) {
    return {
      ...params.cfg,
      channels: {
        ...params.cfg.channels,
        zalo: {
          ...params.cfg.channels?.zalo,
          enabled: true,
          dmPolicy: "allowlist",
          allowFrom,
        },
      },
    } as CoreBlowConfig;
  }
  return {
    ...params.cfg,
    channels: {
      ...params.cfg.channels,
      zalo: {
        ...params.cfg.channels?.zalo,
        accounts: {
          ...params.cfg.channels?.zalo?.accounts,
          [accountId]: {
            ...params.cfg.channels?.zalo?.accounts?.[accountId],
            enabled: true,
            dmPolicy: "allowlist",
            allowFrom,
          },
        },
      },
    },
  } as CoreBlowConfig;
}
