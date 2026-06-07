export const secretTargetRegistryEntries = [
  {
    id: "channels.googlechat.serviceAccount",
    targetType: "channels.googlechat.serviceAccount",
    configFile: "coreblow.json",
    pathPattern: "channels.googlechat.serviceAccount",
    refPathPattern: "channels.googlechat.serviceAccountRef",
    secretShape: "sibling_ref", // pragma: allowlist secret
    expectedResolvedValue: "string-or-object",
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
