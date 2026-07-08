import type { PluginInstallRecord } from "../config/types.plugins.js";
import type {
  InstalledPluginIndex,
  InstalledPluginInstallRecordInfo,
} from "./installed-plugin-index-types.js";

function setInstallStringField<Key extends keyof Omit<InstalledPluginInstallRecordInfo, "source">>(
  target: InstalledPluginInstallRecordInfo,
  key: Key,
  value: PluginInstallRecord[Key],
): void {
  if (typeof value === "string" && value.trim()) {
    target[key] = value as InstalledPluginInstallRecordInfo[Key];
  }
}

function normalizeInstallRecord(
  record: PluginInstallRecord | undefined,
): InstalledPluginInstallRecordInfo | undefined {
  if (!record) {
    return undefined;
  }
  const normalized: InstalledPluginInstallRecordInfo = {
    source: record.source,
  };
  setInstallStringField(normalized, "spec", record.spec);
  setInstallStringField(normalized, "sourcePath", record.sourcePath);
  setInstallStringField(normalized, "installPath", record.installPath);
  setInstallStringField(normalized, "version", record.version);
  setInstallStringField(normalized, "resolvedName", record.resolvedName);
  setInstallStringField(normalized, "resolvedVersion", record.resolvedVersion);
  setInstallStringField(normalized, "resolvedSpec", record.resolvedSpec);
  setInstallStringField(normalized, "integrity", record.integrity);
  setInstallStringField(normalized, "shasum", record.shasum);
  setInstallStringField(normalized, "resolvedAt", record.resolvedAt);
  setInstallStringField(normalized, "installedAt", record.installedAt);
  return normalized;
}

function restoreInstallRecord(
  record: InstalledPluginInstallRecordInfo | undefined,
): PluginInstallRecord | undefined {
  if (!record?.source) {
    return undefined;
  }
  return structuredClone(record) as PluginInstallRecord;
}

export function normalizeInstallRecordMap(
  records: Record<string, PluginInstallRecord> | undefined,
): Record<string, InstalledPluginInstallRecordInfo> {
  const normalized: Record<string, InstalledPluginInstallRecordInfo> = {};
  for (const [pluginId, record] of Object.entries(records ?? {}).toSorted(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const installRecord = normalizeInstallRecord(record);
    if (installRecord) {
      normalized[pluginId] = installRecord;
    }
  }
  return normalized;
}

export function extractPluginInstallRecordsFromInstalledPluginIndex(
  index: InstalledPluginIndex | null | undefined,
): Record<string, PluginInstallRecord> {
  if (index && Object.prototype.hasOwnProperty.call(index, "installRecords")) {
    const restored: Record<string, PluginInstallRecord> = {};
    for (const [pluginId, record] of Object.entries(index.installRecords ?? {})) {
      const installRecord = restoreInstallRecord(record);
      if (installRecord) {
        restored[pluginId] = installRecord;
      }
    }
    return restored;
  }
  const records: Record<string, PluginInstallRecord> = {};
  for (const plugin of index?.plugins ?? []) {
    const record = restoreInstallRecord(plugin.installRecord);
    if (record) {
      records[plugin.pluginId] = record;
    }
  }
  return records;
}
