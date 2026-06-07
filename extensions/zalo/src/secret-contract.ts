export const secretTargetRegistryEntries = [
  {
    id: "channels.zalo.accounts.*.botToken",
    targetType: "channels.zalo.accounts.*.botToken",
    configFile: "coreblow.json",
    pathPattern: "channels.zalo.accounts.*.botToken",
    secretShape: "secret_input", // pragma: allowlist secret
    expectedResolvedValue: "string",
    includeInPlan: true,
    includeInConfigure: true,
    includeInAudit: true,
  },
  {
    id: "channels.zalo.accounts.*.webhookSecret",
    targetType: "channels.zalo.accounts.*.webhookSecret",
    configFile: "coreblow.json",
    pathPattern: "channels.zalo.accounts.*.webhookSecret",
    secretShape: "secret_input", // pragma: allowlist secret
    expectedResolvedValue: "string",
    includeInPlan: true,
    includeInConfigure: true,
    includeInAudit: true,
  },
  {
    id: "channels.zalo.botToken",
    targetType: "channels.zalo.botToken",
    configFile: "coreblow.json",
    pathPattern: "channels.zalo.botToken",
    secretShape: "secret_input", // pragma: allowlist secret
    expectedResolvedValue: "string",
    includeInPlan: true,
    includeInConfigure: true,
    includeInAudit: true,
  },
  {
    id: "channels.zalo.webhookSecret",
    targetType: "channels.zalo.webhookSecret",
    configFile: "coreblow.json",
    pathPattern: "channels.zalo.webhookSecret",
    secretShape: "secret_input", // pragma: allowlist secret
    expectedResolvedValue: "string",
    includeInPlan: true,
    includeInConfigure: true,
    includeInAudit: true,
  },
] as const;

export function collectRuntimeConfigAssignments(): void {}

export const channelSecrets = {
  secretTargetRegistryEntries,
  collectRuntimeConfigAssignments,
};
