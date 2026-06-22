import { createResolvedApproverActionAuthAdapter } from "coreblow/plugin-sdk/approval-runtime";
import { resolveNextcloudTalkAccount } from "./accounts.js";
import type { CoreConfig } from "./types.js";

export function normalizeNextcloudTalkApproverId(value: string | number): string | undefined {
  const normalized = String(value)
    .trim()
    .replace(/^(nextcloud-talk|nc-talk|nc):/i, "")
    .trim()
    .toLowerCase();
  return normalized || undefined;
}

export const nextcloudTalkApprovalAuth = createResolvedApproverActionAuthAdapter({
  channelLabel: "Nextcloud Talk",
  resolveApprovers: ({ cfg, accountId }) => {
    const account = resolveNextcloudTalkAccount({ cfg: cfg as CoreConfig, accountId });
    return (account.config.allowFrom ?? [])
      .map(normalizeNextcloudTalkApproverId)
      .filter((value): value is string => Boolean(value));
  },
  normalizeSenderId: normalizeNextcloudTalkApproverId,
});
