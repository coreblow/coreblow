import { resolveChannelGroupRequireMention } from "coreblow/plugin-sdk/channel-policy";
import type { CoreBlowConfig } from "coreblow/plugin-sdk/core";

type GoogleChatGroupContext = {
  cfg: CoreBlowConfig;
  accountId?: string | null;
  groupId?: string | null;
};

export function resolveGoogleChatGroupRequireMention(params: GoogleChatGroupContext): boolean {
  return resolveChannelGroupRequireMention({
    cfg: params.cfg,
    channel: "googlechat",
    groupId: params.groupId,
    accountId: params.accountId,
  });
}
