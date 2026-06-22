import {
  legacyConfigRules as MATTERMOST_LEGACY_CONFIG_RULES,
  normalizeCompatibilityConfig as normalizeMattermostCompatibilityConfig,
} from "./doctor-contract.js";

type ChannelDoctorAdapter = {
  legacyConfigRules: typeof MATTERMOST_LEGACY_CONFIG_RULES;
  normalizeCompatibilityConfig: typeof normalizeMattermostCompatibilityConfig;
  collectMutableAllowlistWarnings: (params: {
    cfg: { channels?: Record<string, unknown> };
  }) => string[];
};

function isMattermostMutableAllowEntry(raw: string): boolean {
  const text = raw.trim();
  if (!text || text === "*") {
    return false;
  }
  const normalized = text
    .replace(/^(mattermost|user):/i, "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase();
  return !/^[a-z0-9]{26}$/.test(normalized);
}

function collectWarningsForList(pathLabel: string, list: unknown): string[] {
  if (!Array.isArray(list)) {
    return [];
  }
  const hits = list
    .filter((entry): entry is string => typeof entry === "string")
    .filter(isMattermostMutableAllowEntry);
  if (hits.length === 0) {
    return [];
  }
  return [`${pathLabel} contains mutable allowlist entries: ${hits.join(", ")}`];
}

function collectMattermostMutableAllowlistWarnings(params: {
  cfg: { channels?: Record<string, unknown> };
}): string[] {
  const channel = params.cfg.channels?.mattermost as Record<string, unknown> | undefined;
  if (!channel) {
    return [];
  }
  const warnings = [
    ...collectWarningsForList("channels.mattermost.allowFrom", channel.allowFrom),
    ...collectWarningsForList("channels.mattermost.groupAllowFrom", channel.groupAllowFrom),
  ];
  const accounts = channel.accounts as Record<string, Record<string, unknown> | undefined> | undefined;
  for (const [accountId, account] of Object.entries(accounts ?? {})) {
    if (!account) {
      continue;
    }
    warnings.push(
      ...collectWarningsForList(
        `channels.mattermost.accounts.${accountId}.allowFrom`,
        account.allowFrom,
      ),
    );
    warnings.push(
      ...collectWarningsForList(
        `channels.mattermost.accounts.${accountId}.groupAllowFrom`,
        account.groupAllowFrom,
      ),
    );
  }
  return warnings;
}

export const mattermostDoctor: ChannelDoctorAdapter = {
  legacyConfigRules: MATTERMOST_LEGACY_CONFIG_RULES,
  normalizeCompatibilityConfig: normalizeMattermostCompatibilityConfig,
  collectMutableAllowlistWarnings: collectMattermostMutableAllowlistWarnings,
};
