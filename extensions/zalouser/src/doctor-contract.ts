import type { CoreBlowConfig } from "coreblow/plugin-sdk/config-contracts";

type ChannelDoctorConfigMutation = { config: CoreBlowConfig; changes: string[] };
type ChannelDoctorLegacyConfigRule = {
  path: string[];
  message: string;
  match: (value: unknown) => boolean;
};

function asObjectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function hasLegacyZalouserGroupAllowAlias(value: unknown): boolean {
  const group = asObjectRecord(value);
  return Boolean(group && typeof group.allow === "boolean");
}

function hasLegacyZalouserGroupAllowAliases(value: unknown): boolean {
  const groups = asObjectRecord(value);
  return Boolean(
    groups && Object.values(groups).some((group) => hasLegacyZalouserGroupAllowAlias(group)),
  );
}

function normalizeZalouserGroupAllowAliases(params: {
  groups: Record<string, unknown>;
  pathPrefix: string;
  changes: string[];
}): { groups: Record<string, unknown>; changed: boolean } {
  let changed = false;
  const nextGroups: Record<string, unknown> = { ...params.groups };
  for (const [groupId, groupValue] of Object.entries(params.groups)) {
    const group = asObjectRecord(groupValue);
    if (!group || typeof group.allow !== "boolean") {
      continue;
    }
    const nextGroup = { ...group };
    if (typeof nextGroup.enabled !== "boolean") {
      nextGroup.enabled = group.allow;
    }
    delete nextGroup.allow;
    nextGroups[groupId] = nextGroup;
    changed = true;
    params.changes.push(
      `Moved ${params.pathPrefix}.${groupId}.allow -> ${params.pathPrefix}.${groupId}.enabled (${String(nextGroup.enabled)}).`,
    );
  }
  return { groups: nextGroups, changed };
}

function normalizeZalouserCompatibilityConfig(cfg: CoreBlowConfig): ChannelDoctorConfigMutation {
  const channels = asObjectRecord(cfg.channels);
  const zalouser = asObjectRecord(channels?.zalouser);
  if (!zalouser) {
    return { config: cfg, changes: [] };
  }
  const changes: string[] = [];
  let updatedZalouser: Record<string, unknown> = zalouser;
  let changed = false;
  const groups = asObjectRecord(updatedZalouser.groups);
  if (groups) {
    const normalized = normalizeZalouserGroupAllowAliases({
      groups,
      pathPrefix: "channels.zalouser.groups",
      changes,
    });
    if (normalized.changed) {
      updatedZalouser = { ...updatedZalouser, groups: normalized.groups };
      changed = true;
    }
  }
  if (!changed) {
    return { config: cfg, changes: [] };
  }
  return {
    config: {
      ...cfg,
      channels: {
        ...cfg.channels,
        zalouser: updatedZalouser as never,
      },
    },
    changes,
  };
}

export const legacyConfigRules: ChannelDoctorLegacyConfigRule[] = [
  {
    path: ["channels", "zalouser", "groups"],
    message:
      'channels.zalouser.groups.<id>.allow is legacy; use channels.zalouser.groups.<id>.enabled instead. Run "coreblow doctor --fix".',
    match: hasLegacyZalouserGroupAllowAliases,
  },
];

export function normalizeCompatibilityConfig(params: {
  cfg: CoreBlowConfig;
}): ChannelDoctorConfigMutation {
  return normalizeZalouserCompatibilityConfig(params.cfg);
}
