export const secretTargetRegistryEntries = [
  "accounts.*.botToken",
  "botToken",
].map((suffix) => ({
  id: `channels.mattermost.${suffix}`,
  targetType: `channels.mattermost.${suffix}`,
  configFile: "coreblow.json",
  pathPattern: `channels.mattermost.${suffix}`,
  secretShape: "secret_input" as const, // pragma: allowlist secret
  expectedResolvedValue: "string" as const,
  includeInPlan: true,
  includeInConfigure: true,
  includeInAudit: true,
}));

export function collectRuntimeConfigAssignments(params: {
  config: { channels?: Record<string, unknown> };
  context: { assign?: (assignment: { path: string; value: unknown }) => void };
}): void {
  const channel = params.config.channels?.mattermost as Record<string, unknown> | undefined;
  if (!channel || !params.context.assign) {
    return;
  }
  if (channel.botToken !== undefined) {
    params.context.assign({ path: "channels.mattermost.botToken", value: channel.botToken });
  }
  const accounts = channel.accounts as Record<string, Record<string, unknown> | undefined> | undefined;
  for (const [accountId, account] of Object.entries(accounts ?? {})) {
    if (!account || account.enabled === false || account.botToken === undefined) {
      continue;
    }
    params.context.assign({
      path: `channels.mattermost.accounts.${accountId}.botToken`,
      value: account.botToken,
    });
  }
}

export const channelSecrets = {
  secretTargetRegistryEntries,
  collectRuntimeConfigAssignments,
};
