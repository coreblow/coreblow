import { formatAllowFromLowercase } from "coreblow/plugin-sdk/allow-from";
import {
  adaptScopedAccountAccessor,
  createScopedChannelConfigAdapter,
  createScopedDmSecurityResolver,
} from "coreblow/plugin-sdk/channel-config-helpers";
import { createPairingPrefixStripper } from "coreblow/plugin-sdk/channel-pairing";
import {
  listNextcloudTalkAccountIds,
  resolveDefaultNextcloudTalkAccountId,
  resolveNextcloudTalkAccount,
  type ResolvedNextcloudTalkAccount,
} from "./accounts.js";
import type { CoreConfig } from "./types.js";

const prefix = /^(nextcloud-talk|nc-talk|nc):/i;
const normalizeEntry = (value: string) => value.trim().replace(prefix, "").trim().toLowerCase();

export const nextcloudTalkConfigAdapter = createScopedChannelConfigAdapter<
  ResolvedNextcloudTalkAccount,
  ResolvedNextcloudTalkAccount,
  CoreConfig
>({
  sectionKey: "nextcloud-talk",
  listAccountIds: listNextcloudTalkAccountIds,
  resolveAccount: adaptScopedAccountAccessor(resolveNextcloudTalkAccount),
  defaultAccountId: resolveDefaultNextcloudTalkAccountId,
  clearBaseFields: ["botSecret", "botSecretFile", "baseUrl", "name"],
  resolveAllowFrom: (account) => account.config.allowFrom,
  formatAllowFrom: (allowFrom) => formatAllowFromLowercase({ allowFrom, stripPrefixRe: prefix }),
});

export const nextcloudTalkSecurityAdapter = {
  resolveDmPolicy: createScopedDmSecurityResolver<ResolvedNextcloudTalkAccount>({
    channelKey: "nextcloud-talk",
    resolvePolicy: (account) => account.config.dmPolicy,
    resolveAllowFrom: (account) => account.config.allowFrom,
    policyPathSuffix: "dmPolicy",
    normalizeEntry,
  }),
};

export const nextcloudTalkPairingTextAdapter = {
  idLabel: "nextcloudUserId",
  message: "CoreBlow: your access has been approved.",
  normalizeAllowEntry: createPairingPrefixStripper(prefix, normalizeEntry),
};
