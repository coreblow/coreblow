export const secretTargetRegistryEntries = [
  "accounts.*.apiPassword",
  "accounts.*.botSecret",
  "apiPassword",
  "botSecret",
].map((suffix) => ({
  id: `channels.nextcloud-talk.${suffix}`,
  targetType: `channels.nextcloud-talk.${suffix}`,
  configFile: "coreblow.json",
  pathPattern: `channels.nextcloud-talk.${suffix}`,
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
  const channel = params.config.channels?.["nextcloud-talk"] as Record<string, unknown> | undefined;
  if (!channel || !params.context.assign) return;
  for (const field of ["apiPassword", "botSecret"] as const) {
    if (channel[field] !== undefined) params.context.assign({ path: `channels.nextcloud-talk.${field}`, value: channel[field] });
  }
  const accounts = channel.accounts as Record<string, Record<string, unknown> | undefined> | undefined;
  for (const [accountId, account] of Object.entries(accounts ?? {})) {
    if (!account || account.enabled === false) continue;
    for (const field of ["apiPassword", "botSecret"] as const) {
      if (account[field] !== undefined) params.context.assign({ path: `channels.nextcloud-talk.accounts.${accountId}.${field}`, value: account[field] });
    }
  }
}

export const channelSecrets = { secretTargetRegistryEntries, collectRuntimeConfigAssignments };
