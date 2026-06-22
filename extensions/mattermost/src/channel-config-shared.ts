import { describeAccountSnapshot } from "coreblow/plugin-sdk/account-helpers";
import { formatNormalizedAllowFromEntries } from "coreblow/plugin-sdk/allow-from";
import {
  adaptScopedAccountAccessor,
  createScopedChannelConfigAdapter,
} from "coreblow/plugin-sdk/channel-config-helpers";
import { resolveMattermostGatewayAuthBypassPaths } from "./gateway-auth-bypass.js";
import {
  listMattermostAccountIds,
  resolveDefaultMattermostAccountId,
  resolveMattermostAccount,
  type ResolvedMattermostAccount,
} from "./mattermost/accounts.js";
import { hasConfiguredSecretInput } from "./secret-input.js";

export const mattermostMeta = {
  id: "mattermost",
  label: "Mattermost",
  selectionLabel: "Mattermost (plugin)",
  detailLabel: "Mattermost Bot",
  docsPath: "/channels/mattermost",
  docsLabel: "mattermost",
  blurb: "self-hosted Slack-style chat; install the plugin to enable.",
  systemImage: "bubble.left.and.bubble.right",
  order: 65,
  quickstartAllowFrom: true,
} as const;

export function normalizeMattermostAllowEntry(entry: string): string {
  return entry
    .trim()
    .replace(/^(mattermost|user):/i, "")
    .replace(/^@/, "")
    .toLowerCase();
}

function formatMattermostAllowEntry(entry: string): string {
  const trimmed = entry.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("@")) {
    const username = trimmed.slice(1).trim();
    return username ? `@${username.toLowerCase()}` : "";
  }
  return trimmed.replace(/^(mattermost|user):/i, "").toLowerCase();
}

export { resolveMattermostGatewayAuthBypassPaths };

export const mattermostConfigAdapter = createScopedChannelConfigAdapter<ResolvedMattermostAccount>({
  sectionKey: "mattermost",
  listAccountIds: listMattermostAccountIds,
  resolveAccount: adaptScopedAccountAccessor(resolveMattermostAccount),
  defaultAccountId: resolveDefaultMattermostAccountId,
  clearBaseFields: ["botToken", "baseUrl", "name"],
  resolveAllowFrom: (account) => account.config.allowFrom,
  formatAllowFrom: (allowFrom) =>
    formatNormalizedAllowFromEntries({
      allowFrom,
      normalizeEntry: formatMattermostAllowEntry,
    }),
});

export function isMattermostConfigured(account: ResolvedMattermostAccount): boolean {
  const tokenConfigured =
    Boolean(account.botToken?.trim()) || hasConfiguredSecretInput(account.config.botToken);
  return tokenConfigured && Boolean(account.baseUrl);
}

export function describeMattermostAccount(account: ResolvedMattermostAccount) {
  return describeAccountSnapshot({
    account,
    configured: isMattermostConfigured(account),
    extra: {
      botTokenSource: account.botTokenSource,
      baseUrl: account.baseUrl,
    },
  });
}
