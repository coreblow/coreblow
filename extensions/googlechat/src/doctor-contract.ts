import type { CoreBlowConfig } from "../runtime-api.js";

export type ChannelDoctorConfigMutation = {
  config: CoreBlowConfig;
  changes: string[];
};

export type ChannelDoctorLegacyConfigRule = {
  path: string[];
  message: string;
  match: (value: unknown) => boolean;
};

function asObjectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function hasLegacyGoogleChatStreamMode(value: unknown): boolean {
  return asObjectRecord(value)?.streamMode !== undefined;
}

function hasLegacyGoogleChatGroupAllowAlias(value: unknown): boolean {
  const groups = asObjectRecord(asObjectRecord(value)?.groups);
  return Boolean(
    groups &&
      Object.values(groups).some((group) =>
        Object.prototype.hasOwnProperty.call(asObjectRecord(group) ?? {}, "allow"),
      ),
  );
}

export const legacyConfigRules: ChannelDoctorLegacyConfigRule[] = [
  {
    path: ["channels", "googlechat"],
    message: "channels.googlechat.streamMode is legacy and no longer used.",
    match: hasLegacyGoogleChatStreamMode,
  },
  {
    path: ["channels", "googlechat"],
    message:
      "channels.googlechat.groups.<id>.allow is legacy; use channels.googlechat.groups.<id>.enabled instead.",
    match: hasLegacyGoogleChatGroupAllowAlias,
  },
];

export function normalizeCompatibilityConfig({
  cfg,
}: {
  cfg: CoreBlowConfig;
}): ChannelDoctorConfigMutation {
  const rawEntry = asObjectRecord(cfg.channels?.googlechat);
  if (!rawEntry) {
    return { config: cfg, changes: [] };
  }
  let changed = false;
  const changes: string[] = [];
  const nextEntry = { ...rawEntry };
  if (nextEntry.streamMode !== undefined) {
    delete nextEntry.streamMode;
    changes.push("Removed channels.googlechat.streamMode.");
    changed = true;
  }
  const groups = asObjectRecord(nextEntry.groups);
  if (groups) {
    const nextGroups = { ...groups };
    for (const [groupId, groupValue] of Object.entries(groups)) {
      const group = asObjectRecord(groupValue);
      if (!group || !Object.prototype.hasOwnProperty.call(group, "allow")) {
        continue;
      }
      const nextGroup = { ...group };
      if (nextGroup.enabled === undefined) {
        nextGroup.enabled = group.allow;
      }
      delete nextGroup.allow;
      nextGroups[groupId] = nextGroup;
      changed = true;
      changes.push(`Moved channels.googlechat.groups.${groupId}.allow to enabled.`);
    }
    nextEntry.groups = nextGroups;
  }
  return changed
    ? {
        config: {
          ...cfg,
          channels: { ...cfg.channels, googlechat: nextEntry as never },
        },
        changes,
      }
    : { config: cfg, changes: [] };
}
